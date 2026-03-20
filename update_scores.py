"""
Auto-update script for Webster Family Bracket Challenge.
Fetches NCAA tournament scores and updates bracket_data.json.
Runs via GitHub Actions every hour during tournament days.
"""
import json
import urllib.request
import urllib.error
import os
import sys
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, "bracket_data.json")

ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=100&dates={date}"

TEAM_NAME_MAP = {
    "pv a&m/lehigh": ["prairie view a&m", "lehigh", "prairie view", "pv a&m"],
    "umbc/howard": ["umbc", "howard"],
    "tx/nc state": ["texas", "nc state", "north carolina state"],
    "smu/miami oh": ["smu", "miami (oh)", "miami ohio", "miami oh"],
    "n. dakota state": ["north dakota state", "north dakota st", "ndsu"],
    "st. john's": ["st. john's (ny)", "st john's", "saint john's"],
    "cal baptist": ["california baptist"],
    "northern iowa": ["northern iowa", "uni"],
    "michigan state": ["michigan state", "michigan st"],
    "saint mary's": ["saint mary's (ca)", "saint mary's", "st. mary's"],
    "miami (fl)": ["miami", "miami hurricanes"],
    "tennessee state": ["tennessee state", "tennessee st"],
    "wright state": ["wright state"],
    "kennesaw state": ["kennesaw state", "kennesaw st"],
    "iowa state": ["iowa state", "iowa st"],
    "ohio state": ["ohio state", "ohio st"],
    "texas a&m": ["texas a&m"],
    "south florida": ["south florida", "usf"],
    "santa clara": ["santa clara"],
}

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}")

def fetch_json(url):
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        log(f"Error fetching {url}: {e}")
        return None

def normalize_team_name(name):
    return name.lower().strip().replace("'", "'").replace("\u2019", "'")

def espn_name_matches(espn_name, our_name):
    espn_lower = normalize_team_name(espn_name)
    our_lower = normalize_team_name(our_name)
    if espn_lower == our_lower:
        return True
    if espn_lower in our_lower or our_lower in espn_lower:
        return True
    aliases = TEAM_NAME_MAP.get(our_lower, [])
    for alias in aliases:
        if normalize_team_name(alias) == espn_lower or normalize_team_name(alias) in espn_lower:
            return True
    return False

def get_tournament_dates():
    return [
        "20260317", "20260318", "20260319", "20260320",
        "20260321", "20260322", "20260323",
        "20260326", "20260327", "20260328", "20260329",
        "20260404", "20260406"
    ]

def fetch_completed_games():
    completed = []
    today = datetime.now().strftime("%Y%m%d")
    dates = get_tournament_dates()
    dates_to_check = [d for d in dates if d <= today]

    for date in dates_to_check:
        url = ESPN_SCOREBOARD_URL.format(date=date)
        data = fetch_json(url)
        if not data or "events" not in data:
            continue
        for event in data["events"]:
            try:
                competition = event["competitions"][0]
                status = competition["status"]["type"]["name"]
                if status != "STATUS_FINAL":
                    continue
                teams = competition["competitors"]
                team1_name = teams[0]["team"]["displayName"]
                team1_score = int(teams[0]["score"])
                team2_name = teams[1]["team"]["displayName"]
                team2_score = int(teams[1]["score"])
                winner_name = team1_name if team1_score > team2_score else team2_name
                completed.append({
                    "team1": team1_name, "team1_score": team1_score,
                    "team2": team2_name, "team2_score": team2_score,
                    "winner": winner_name, "date": date,
                })
            except (KeyError, IndexError):
                continue
    return completed

def update_master_bracket(bracket_data, completed_games):
    master = bracket_data["master"]
    updated = False
    for game in completed_games:
        for region in master["regions"]:
            for matchup in region["matchups"]:
                team1_name = matchup[0]["name"]
                team2_name = matchup[1]["name"]
                game_matches = (
                    (espn_name_matches(game["team1"], team1_name) or espn_name_matches(game["team2"], team1_name)) and
                    (espn_name_matches(game["team1"], team2_name) or espn_name_matches(game["team2"], team2_name))
                )
                if game_matches:
                    matched_winner = None
                    if espn_name_matches(game["winner"], team1_name):
                        matched_winner = team1_name
                    elif espn_name_matches(game["winner"], team2_name):
                        matched_winner = team2_name
                    if matched_winner:
                        r32_winners = region["round_winners"].get("Round of 32", [])
                        already_recorded = any(
                            normalize_team_name(w) == normalize_team_name(matched_winner)
                            for w in r32_winners
                        )
                        if not already_recorded:
                            r32_winners.append(matched_winner)
                            region["round_winners"]["Round of 32"] = r32_winners
                            log(f"Updated: {matched_winner} won in {region['name']} (R64)")
                            updated = True
    return updated

def recalculate_scores(bracket_data):
    master = bracket_data["master"]
    scoring_values = list(bracket_data["scoring"].values())
    round_keys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"]
    for participant in bracket_data["participants"]:
        total_score = 0
        for ri in range(4):
            master_region = master["regions"][ri]
            pick_region = participant["regions"][ri]
            for rki, rk in enumerate(round_keys):
                master_winners = [normalize_team_name(w) for w in master_region["round_winners"].get(rk, [])]
                pick_winners = pick_region["round_winners"].get(rk, [])
                pts = scoring_values[rki] if rki < len(scoring_values) else 0
                for pick in pick_winners:
                    if normalize_team_name(pick) in master_winners:
                        total_score += pts
        participant["score"] = total_score
    sorted_participants = sorted(bracket_data["participants"], key=lambda p: p["score"], reverse=True)
    bracket_data["standings"] = [{"name": p["name"], "score": p["score"]} for p in sorted_participants]

def main():
    log("=== Starting score update ===")
    if not os.path.exists(DATA_FILE):
        log(f"ERROR: {DATA_FILE} not found.")
        sys.exit(1)
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        bracket_data = json.load(f)
    log("Fetching scores from ESPN...")
    completed_games = fetch_completed_games()
    log(f"Found {len(completed_games)} completed tournament games")
    if not completed_games:
        log("No completed games found. Exiting.")
        return
    updated = update_master_bracket(bracket_data, completed_games)
    if updated:
        log("Recalculating scores...")
        recalculate_scores(bracket_data)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(bracket_data, f, indent=2)
        log("bracket_data.json updated successfully!")
        log(f"Updated standings: {bracket_data['standings']}")
    else:
        log("No new results to update.")
    log("=== Update complete ===")

if __name__ == "__main__":
    main()
