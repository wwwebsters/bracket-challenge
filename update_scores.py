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
    "pv a&m/lehigh": ["prairie view a&m", "prairie view a&m panthers", "lehigh", "lehigh mountain hawks", "prairie view", "pv a&m"],
    "umbc/howard": ["umbc", "umbc retrievers", "howard", "howard bison"],
    "tx/nc state": ["texas", "texas longhorns", "nc state", "nc state wolfpack", "north carolina state"],
    "smu/miami oh": ["smu", "smu mustangs", "miami (oh)", "miami (oh) redhawks", "miami ohio", "miami oh"],
    "n. dakota state": ["north dakota state", "north dakota state bison", "north dakota st", "ndsu"],
    "st. john's": ["st. john's (ny)", "st john's", "saint john's", "st. john's red storm"],
    "cal baptist": ["california baptist", "california baptist lancers"],
    "northern iowa": ["northern iowa", "northern iowa panthers", "uni"],
    "michigan state": ["michigan state", "michigan state spartans", "michigan st"],
    "saint mary's": ["saint mary's (ca)", "saint mary's", "st. mary's", "saint mary's gaels"],
    "miami (fl)": ["miami", "miami hurricanes"],
    "tennessee state": ["tennessee state", "tennessee state tigers", "tennessee st"],
    "wright state": ["wright state", "wright state raiders"],
    "kennesaw state": ["kennesaw state", "kennesaw state owls", "kennesaw st"],
    "iowa state": ["iowa state", "iowa state cyclones", "iowa st"],
    "ohio state": ["ohio state", "ohio state buckeyes", "ohio st"],
    "texas a&m": ["texas a&m", "texas a&m aggies"],
    "south florida": ["south florida", "south florida bulls", "usf"],
    "santa clara": ["santa clara", "santa clara broncos"],
    "hawaii": ["hawai'i", "hawai'i rainbow warriors", "hawaii rainbow warriors"],
    "liu": ["long island university", "long island university sharks", "liu sharks"],
    "mcneese": ["mcneese", "mcneese cowboys", "mcneese state"],
    "penn": ["pennsylvania", "pennsylvania quakers", "penn quakers"],
    "queens": ["queens university", "queens university royals"],
}

# Map ESPN round labels to our round_winners keys
ESPN_ROUND_MAP = {
    "1st round": "Round of 32",
    "2nd round": "Sweet 16",
    "sweet 16": "Elite 8",
    "elite eight": "Final Four",
    "elite 8": "Final Four",
    "semifinal": "Finalist",
    "final four": "Finalist",
    "national championship": "Champion",
    "championship": "Champion",
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
    return name.lower().strip().replace("\u2019", "'").replace("\u2018", "'")

def word_boundary_match(needle, haystack):
    """Check if needle appears as a whole word/phrase in haystack (not as substring of another word)."""
    import re
    pattern = r'(?:^|\b)' + re.escape(needle) + r'(?:\b|$)'
    return bool(re.search(pattern, haystack))

def espn_name_matches(espn_name, our_name):
    espn_lower = normalize_team_name(espn_name)
    our_lower = normalize_team_name(our_name)
    if espn_lower == our_lower:
        return True
    # Use word-boundary matching to avoid "kansas" matching "arkansas"
    if word_boundary_match(our_lower, espn_lower) or word_boundary_match(espn_lower, our_lower):
        return True
    aliases = TEAM_NAME_MAP.get(our_lower, [])
    for alias in aliases:
        a = normalize_team_name(alias)
        if a == espn_lower or word_boundary_match(a, espn_lower) or word_boundary_match(espn_lower, a):
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

                # Extract round from notes
                notes = competition.get("notes", [])
                note = notes[0].get("headline", "") if notes else ""
                espn_round = ""
                if " - " in note:
                    espn_round = note.split(" - ")[-1].strip().lower()

                completed.append({
                    "team1": team1_name, "team1_score": team1_score,
                    "team2": team2_name, "team2_score": team2_score,
                    "winner": winner_name, "date": date,
                    "espn_round": espn_round,
                })
            except (KeyError, IndexError):
                continue
    return completed

def get_all_region_teams(region):
    teams = []
    for matchup in region["matchups"]:
        teams.append(matchup[0]["name"])
        teams.append(matchup[1]["name"])
    return teams

def find_our_name_for_espn(espn_name, all_teams):
    for our_name in all_teams:
        if espn_name_matches(espn_name, our_name):
            return our_name
    return None

def update_master_bracket(bracket_data, completed_games):
    master = bracket_data["master"]
    updated = False

    for game in completed_games:
        # Skip First Four games — they don't correspond to bracket matchup wins
        if "first four" in game["espn_round"]:
            continue

        # Determine which of our round_winners keys this maps to
        target_round = ESPN_ROUND_MAP.get(game["espn_round"])
        if not target_round:
            log(f"Unknown ESPN round: '{game['espn_round']}' for {game['winner']} — skipping")
            continue

        # Find which region this game belongs to by matching the winner
        for region in master["regions"]:
            all_teams = get_all_region_teams(region)
            our_winner = find_our_name_for_espn(game["winner"], all_teams)

            if not our_winner:
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
            break  # Found the region, no need to check others

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
