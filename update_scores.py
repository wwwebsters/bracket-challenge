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

def get_all_region_teams(region):
    """Get all team names in a region (from matchups)."""
    teams = []
    for matchup in region["matchups"]:
        teams.append(matchup[0]["name"])
        teams.append(matchup[1]["name"])
    return teams

def find_our_name_for_espn(espn_name, all_teams):
    """Given an ESPN team name, find the matching name from our bracket."""
    for our_name in all_teams:
        if espn_name_matches(espn_name, our_name):
            return our_name
    return None

def determine_round(region, winner_name, loser_name):
    """Determine which round a game belongs to based on which teams are playing."""
    round_keys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"]
    # If both teams are in the previous round's winners, they're playing in the next round
    # R64 game: both teams are original matchup teams -> winner goes to "Round of 32"
    # R32 game: both teams are in "Round of 32" -> winner goes to "Sweet 16"
    # etc.

    # Check if both teams are R64 participants (original matchup teams)
    all_original = get_all_region_teams(region)
    winner_in_original = any(normalize_team_name(winner_name) == normalize_team_name(t) for t in all_original)
    loser_in_original = any(normalize_team_name(loser_name) == normalize_team_name(t) for t in all_original)

    if winner_in_original and loser_in_original:
        # Both are original teams — check what round they're in based on previous round winners
        # If both are in "Round of 32" winners, this is a Sweet 16 game
        for i in range(len(round_keys) - 1, -1, -1):
            rk = round_keys[i]
            prev_winners = [normalize_team_name(w) for w in region["round_winners"].get(rk, [])]
            if normalize_team_name(winner_name) in prev_winners and normalize_team_name(loser_name) in prev_winners:
                # Both in this round's winners, so result goes to next round
                if i + 1 < len(round_keys):
                    return round_keys[i + 1]
        # Neither found in any round winners — this is an R64 game, winner goes to "Round of 32"
        return "Round of 32"
    return None

def update_master_bracket(bracket_data, completed_games):
    master = bracket_data["master"]
    updated = False
    round_keys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"]

    for game in completed_games:
        for region in master["regions"]:
            all_teams = get_all_region_teams(region)

            # Try to match both ESPN teams to our bracket names
            our_winner = find_our_name_for_espn(game["winner"], all_teams)
            our_loser_name = None
            loser_espn = game["team1"] if game["winner"] != game["team1"] else game["team2"]
            our_loser = find_our_name_for_espn(loser_espn, all_teams)

            if not our_winner or not our_loser:
                continue

            # Determine which round this result belongs to
            target_round = determine_round(region, our_winner, our_loser)
            if not target_round:
                continue

            round_winners = region["round_winners"].get(target_round, [])
            already_recorded = any(
                normalize_team_name(w) == normalize_team_name(our_winner)
                for w in round_winners
            )
            if not already_recorded:
                round_winners.append(our_winner)
                region["round_winners"][target_round] = round_winners
                log(f"Updated: {our_winner} won in {region['name']} ({target_round})")
                updated = True

    # Handle Final Four, Finals, Championship (cross-region games)
    # These will be added when those rounds begin

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
