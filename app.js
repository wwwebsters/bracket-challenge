// Webster Family Bracket Challenge 2026
const PASSWORD = "webster2026";
let bracketData = null;

// ===== Password Gate =====
document.getElementById("password-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("password-input").value;
    if (input === PASSWORD) {
        document.getElementById("password-gate").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");
        document.getElementById("app-footer").classList.remove("hidden");
        sessionStorage.setItem("authenticated", "true");
        loadApp();
    } else {
        document.getElementById("password-error").classList.remove("hidden");
        document.getElementById("password-input").value = "";
        document.getElementById("password-input").focus();
    }
});

// Check if already authenticated
if (sessionStorage.getItem("authenticated") === "true") {
    document.getElementById("password-gate").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("app-footer").classList.remove("hidden");
    loadApp();
}

// ===== Navigation =====
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    });
});

// ===== Load App =====
async function loadApp() {
    try {
        const resp = await fetch("bracket_data.json?t=" + Date.now());
        bracketData = await resp.json();
        renderLeaderboard();
        renderBracketSelector();
        renderGames();
        updateTimestamp();
    } catch (err) {
        console.error("Failed to load bracket data:", err);
    }
}

// ===== Refresh =====
document.getElementById("refresh-btn").addEventListener("click", loadApp);

function updateTimestamp() {
    const now = new Date();
    document.getElementById("last-updated").textContent =
        `Updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
}

// ===== Leaderboard =====
function renderLeaderboard() {
    const participants = [...bracketData.participants].sort((a, b) => b.score - a.score);

    // Assign ranks (handle ties)
    let rank = 1;
    participants.forEach((p, i) => {
        if (i > 0 && p.score < participants[i - 1].score) rank = i + 1;
        p.rank = rank;
    });

    // Top 3 cards
    const cardsHtml = participants.slice(0, 3).map((p, i) => {
        const medals = ["&#129351;", "&#129352;", "&#129353;"];
        const classes = ["gold", "silver", "bronze"];
        const roundBreakdown = getParticipantRoundBreakdown(p);
        const maxPossible = calculateMaxPossible(p);
        return `
            <div class="leader-card ${classes[i]}">
                <div class="leader-rank">${medals[i]}</div>
                <div class="leader-name">${p.name}</div>
                <div class="leader-score">${p.score}</div>
                <div class="leader-score-label">points</div>
                <div class="leader-tiebreaker">
                    Tiebreaker: ${p.tiebreaker} &bull; Max possible: ${maxPossible}
                </div>
            </div>
        `;
    }).join("");
    document.getElementById("leaderboard-cards").innerHTML = cardsHtml;

    // Full table
    const tableHtml = participants.map(p => {
        const rb = getParticipantRoundBreakdown(p);
        const maxPossible = calculateMaxPossible(p);
        const rankClass = p.rank <= 3 ? `rank-${p.rank}` : "";
        return `
            <tr>
                <td class="rank-cell ${rankClass}">${p.rank}</td>
                <td class="player-name-cell">${p.name}</td>
                <td class="score-cell">${p.score}</td>
                <td class="round-cell">${formatRoundScore(rb.r32)}</td>
                <td class="round-cell">${formatRoundScore(rb.s16)}</td>
                <td class="round-cell">${formatRoundScore(rb.e8)}</td>
                <td class="round-cell">${formatRoundScore(rb.f4)}</td>
                <td class="round-cell">${formatRoundScore(rb.finals)}</td>
                <td class="round-cell">${formatRoundScore(rb.champ)}</td>
                <td class="max-possible">${maxPossible}</td>
                <td style="color: var(--text-dim); font-size: 13px;">${p.tiebreaker}</td>
            </tr>
        `;
    }).join("");
    document.getElementById("leaderboard-body").innerHTML = tableHtml;
}

function formatRoundScore(val) {
    if (val > 0) return `<span class="correct">${val}</span>`;
    return `${val}`;
}

function getParticipantRoundBreakdown(participant) {
    const master = bracketData.master;
    const scoring = bracketData.scoring;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];
    const roundLabels = ["r32", "s16", "e8", "f4", "finals", "champ"];

    const breakdown = { r32: 0, s16: 0, e8: 0, f4: 0, finals: 0, champ: 0 };

    for (let ri = 0; ri < 4; ri++) {
        const masterRegion = master.regions[ri];
        const pickRegion = participant.regions[ri];

        for (let rki = 0; rki < roundKeys.length; rki++) {
            const rk = roundKeys[rki];
            const label = roundLabels[rki];
            const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
            const pickWinners = (pickRegion.round_winners[rk] || []);

            for (const pick of pickWinners) {
                if (masterWinners.includes(pick.toLowerCase().trim())) {
                    const pts = Object.values(scoring)[rki] || 0;
                    breakdown[label] += pts;
                }
            }
        }
    }

    return breakdown;
}

function calculateMaxPossible(participant) {
    // Current score + points for all picks that are still alive (not yet wrong)
    const master = bracketData.master;
    const scoring = bracketData.scoring;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];

    // Get all eliminated teams from the master bracket
    const allMasterTeams = new Set();
    const advancedTeams = new Set();

    for (const region of master.regions) {
        for (const matchup of region.matchups) {
            for (const team of matchup) {
                allMasterTeams.add(team.name.toLowerCase().trim());
            }
        }
        for (const [rk, winners] of Object.entries(region.round_winners)) {
            for (const w of winners) {
                advancedTeams.add(w.toLowerCase().trim());
            }
        }
    }

    // A team is eliminated if it was in R1 but never shows up as a winner in any round it should have
    // For simplicity, max possible = current score + points for all remaining picks whose team hasn't lost yet
    let maxPts = participant.score;
    const scoringValues = Object.values(scoring);

    for (let ri = 0; ri < 4; ri++) {
        const masterRegion = master.regions[ri];
        const pickRegion = participant.regions[ri];

        for (let rki = 0; rki < roundKeys.length; rki++) {
            const rk = roundKeys[rki];
            const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
            const pickWinners = (pickRegion.round_winners[rk] || []);
            const pts = scoringValues[rki] || 0;

            for (const pick of pickWinners) {
                const pickLower = pick.toLowerCase().trim();
                // Already counted in current score if correct
                if (masterWinners.includes(pickLower)) continue;
                // If this round hasn't been fully played yet, and team could still win
                // Simple heuristic: if team is still in the tournament (hasn't been eliminated)
                if (!isTeamEliminated(pickLower, masterRegion)) {
                    maxPts += pts;
                }
            }
        }
    }

    return maxPts;
}

function isTeamEliminated(teamName, masterRegion) {
    // Check if a team has lost in the master bracket
    // A team is eliminated if: it played in a round and didn't advance
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];

    // Find which matchup the team is in
    let teamInBracket = false;
    for (const matchup of masterRegion.matchups) {
        for (const team of matchup) {
            if (team.name.toLowerCase().trim() === teamName) {
                teamInBracket = true;
                break;
            }
        }
        if (teamInBracket) break;
    }

    if (!teamInBracket) return true; // Team not even in this region

    // Check if team appears in the latest round results
    // If a round has results and team is not in them, team is eliminated at that round
    for (let i = 0; i < roundKeys.length; i++) {
        const rk = roundKeys[i];
        const winners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());

        if (winners.length === 0) continue; // Round not played yet

        // How many winners should this round have?
        const expectedWinners = Math.max(1, 8 >> i); // 8, 4, 2, 1...

        // If round seems complete (has expected number of winners)
        if (winners.length >= expectedWinners) {
            if (!winners.includes(teamName)) {
                return true; // Team didn't advance
            }
        } else {
            // Round partially played - check if team's specific matchup has been decided
            // If team is not in partial results, it might still play
            // For safety, assume not eliminated unless clearly so
        }
    }

    return false;
}

// ===== Bracket Display =====
function renderBracketSelector() {
    const select = document.getElementById("player-select");
    const options = bracketData.participants.map(p =>
        `<option value="${p.id}">${p.name} (${p.score} pts)</option>`
    ).join("");
    select.innerHTML = `<option value="master">Master Bracket (Actual Results)</option>` + options;

    select.addEventListener("change", () => renderBracket(select.value));
    renderBracket("master");
}

function renderBracket(playerId) {
    const container = document.getElementById("bracket-display");
    const isMaster = playerId === "master";
    const source = isMaster ? bracketData.master : bracketData.participants.find(p => p.id === playerId);
    const master = bracketData.master;

    if (!source) { container.innerHTML = "<p>Player not found.</p>"; return; }

    let html = "";

    if (!isMaster) {
        const p = source;
        html += `
            <div class="bracket-player-header">
                <div class="bracket-player-name">${p.name}'s Bracket</div>
                <div class="bracket-player-score">${p.score} pts</div>
                <span style="color: var(--text-dim); font-size: 13px;">Tiebreaker: ${p.tiebreaker}</span>
            </div>
            <div class="bracket-legend">
                <div class="legend-item"><div class="legend-dot correct"></div> Correct Pick</div>
                <div class="legend-item"><div class="legend-dot wrong"></div> Wrong Pick</div>
                <div class="legend-item"><div class="legend-dot pending"></div> Pending</div>
            </div>
        `;
    }

    const regionNames = ["South", "East", "West", "Midwest"];
    const roundKeys = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist"];
    const roundLabels = ["R1", "R32", "S16", "E8", "F4", "FINALS"];

    for (let ri = 0; ri < 4; ri++) {
        const region = source.regions[ri];
        const masterRegion = master.regions[ri];

        html += `<div class="region-bracket">`;
        html += `<div class="region-title">${region.name} REGION</div>`;

        // Show R1 matchups and subsequent round picks
        html += `<div class="bracket-rounds-grid">`;

        // Round 1 - the matchups
        html += `<div class="bracket-round-col">`;
        html += `<div class="round-header">Round of 64</div><div class="round-teams">`;
        for (const matchup of region.matchups) {
            html += `<div class="matchup-pair">`;
            for (const team of matchup) {
                html += `<div class="bracket-team"><span class="seed">${team.seed}</span>${team.name}</div>`;
            }
            html += `</div>`;
        }
        html += `</div></div>`;

        // Subsequent rounds
        const laterRounds = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist"];
        const laterLabels = ["R32", "S16", "E8", "F4", "FINALS"];

        for (let rki = 0; rki < laterRounds.length; rki++) {
            const rk = laterRounds[rki];
            const picks = region.round_winners[rk] || [];
            const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
            const hasResults = masterWinners.length > 0;

            html += `<div class="bracket-round-col">`;
            html += `<div class="round-header">${laterLabels[rki]}</div><div class="round-teams">`;

            for (const pick of picks) {
                let status = "pending";
                if (hasResults) {
                    if (masterWinners.includes(pick.toLowerCase().trim())) {
                        status = "correct";
                    } else {
                        // Check if team is eliminated
                        if (isTeamEliminated(pick.toLowerCase().trim(), masterRegion)) {
                            status = "wrong";
                        }
                    }
                } else if (!isMaster) {
                    // Check if team is already eliminated in earlier round
                    if (isTeamEliminated(pick.toLowerCase().trim(), masterRegion)) {
                        status = "eliminated-pick";
                    }
                }

                const className = isMaster ? "" : status;
                const seedInfo = findTeamSeed(pick, region);
                html += `<div class="bracket-team ${className}">`;
                if (seedInfo) html += `<span class="seed">${seedInfo}</span>`;
                html += `${pick}</div>`;
            }

            if (picks.length === 0 && !isMaster) {
                html += `<div class="bracket-team" style="color: var(--text-dim); font-style: italic;">TBD</div>`;
            }

            html += `</div></div>`;
        }

        html += `</div>`; // bracket-rounds-grid
        html += `</div>`; // region-bracket
    }

    // Final Four / Championship section
    if (!isMaster) {
        const p = source;
        // Find champion pick
        let championPick = "";
        let finalistPicks = [];

        for (const region of p.regions) {
            const champ = region.round_winners["Champion"] || [];
            if (champ.length > 0) championPick = champ[0];
            const finalist = region.round_winners["Finalist"] || [];
            finalistPicks.push(...finalist);
        }

        // Find F4 picks
        let f4Picks = [];
        for (const region of p.regions) {
            const f4 = region.round_winners["Final Four"] || [];
            f4Picks.push(...f4);
        }

        html += `
            <div class="final-four-section">
                <div class="final-four-title">&#127942; FINAL FOUR & CHAMPIONSHIP</div>
                <div class="picks-grid" style="max-width: 600px; margin: 0 auto;">
        `;

        if (f4Picks.length > 0) {
            html += `<div style="grid-column: 1/-1; margin-bottom: 8px;"><strong style="color: var(--text-dim); font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Final Four</strong></div>`;
            for (const pick of f4Picks) {
                const seed = findTeamSeedGlobal(pick, p);
                html += `<div class="pick-item pending">${seed ? `(${seed}) ` : ""}${pick}</div>`;
            }
        }

        if (finalistPicks.length > 0) {
            html += `<div style="grid-column: 1/-1; margin-top: 12px; margin-bottom: 8px;"><strong style="color: var(--text-dim); font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Finalists</strong></div>`;
            for (const pick of finalistPicks) {
                const seed = findTeamSeedGlobal(pick, p);
                html += `<div class="pick-item pending">${seed ? `(${seed}) ` : ""}${pick}</div>`;
            }
        }

        html += `</div>`;

        if (championPick) {
            html += `
                <div class="champion-box">
                    <div class="champion-label">&#128081; CHAMPION PICK</div>
                    <div class="champion-team pending">${championPick}</div>
                </div>
            `;
        }

        html += `</div>`;
    }

    // "Who picked whom" comparison section
    if (!isMaster) {
        html += renderPicksComparison(source);
    }

    container.innerHTML = html;
}

function findTeamSeed(teamName, region) {
    for (const matchup of region.matchups) {
        for (const team of matchup) {
            if (team.name.toLowerCase().trim() === teamName.toLowerCase().trim()) {
                return team.seed;
            }
        }
    }
    return null;
}

function findTeamSeedGlobal(teamName, participant) {
    for (const region of participant.regions) {
        const seed = findTeamSeed(teamName, region);
        if (seed) return seed;
    }
    return null;
}

function renderPicksComparison(currentPlayer) {
    const allPlayers = bracketData.participants;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];
    const roundLabels = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finals", "Champion"];

    let html = `<div class="picks-comparison" style="margin-top: 24px;">`;
    html += `<h3>&#128101; How Everyone Picked</h3>`;

    // Champion picks
    html += `<div style="margin-bottom: 16px;">`;
    html += `<div style="font-size: 12px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Champion Picks</div>`;
    html += `<div class="picks-grid">`;

    for (const player of allPlayers) {
        let champ = "";
        for (const region of player.regions) {
            const c = region.round_winners["Champion"] || [];
            if (c.length > 0) champ = c[0];
        }
        const isCurrent = player.id === currentPlayer.id;
        html += `<div class="pick-item comparison-item" style="${isCurrent ? 'border: 1px solid var(--accent); font-weight: 700;' : ''}">
            <span style="min-width: 50px; font-weight: 600;">${player.name}:</span> ${champ || "N/A"}
        </div>`;
    }

    html += `</div></div>`;

    // Final Four picks
    html += `<div>`;
    html += `<div style="font-size: 12px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Final Four Picks</div>`;
    html += `<div class="picks-grid">`;

    for (const player of allPlayers) {
        let f4 = [];
        for (const region of player.regions) {
            const picks = region.round_winners["Final Four"] || [];
            f4.push(...picks);
        }
        const isCurrent = player.id === currentPlayer.id;
        html += `<div class="pick-item comparison-item" style="${isCurrent ? 'border: 1px solid var(--accent); font-weight: 700;' : ''}; white-space: normal;">
            <span style="min-width: 50px; font-weight: 600;">${player.name}:</span> ${f4.join(", ") || "N/A"}
        </div>`;
    }

    html += `</div></div>`;
    html += `</div>`;

    return html;
}

// ===== Games View =====
function renderGames() {
    const container = document.getElementById("games-list");

    // Show completed games from master bracket
    const master = bracketData.master;
    let gamesHtml = "";
    let gameCount = 0;

    // Extract completed games from master bracket round_winners
    const completedGames = [];

    for (const region of master.regions) {
        const r32Winners = region.round_winners["Round of 32"] || [];

        for (let i = 0; i < region.matchups.length; i++) {
            const matchup = region.matchups[i];
            const team1 = matchup[0];
            const team2 = matchup[1];

            // Check if this game has a winner
            const winner = r32Winners.find(w =>
                w.toLowerCase().trim() === team1.name.toLowerCase().trim() ||
                w.toLowerCase().trim() === team2.name.toLowerCase().trim()
            );

            if (winner) {
                completedGames.push({
                    team1: team1,
                    team2: team2,
                    winner: winner,
                    region: region.name,
                    round: "Round of 64"
                });
            } else {
                completedGames.push({
                    team1: team1,
                    team2: team2,
                    winner: null,
                    region: region.name,
                    round: "Round of 64",
                    upcoming: true
                });
            }
        }
    }

    // Split into completed and upcoming
    const completed = completedGames.filter(g => g.winner);
    const upcoming = completedGames.filter(g => !g.winner);

    if (completed.length > 0) {
        gamesHtml += `<div class="game-date-header">&#9989; COMPLETED GAMES - ROUND OF 64</div>`;
        for (const game of completed) {
            const t1Won = game.winner.toLowerCase().trim() === game.team1.name.toLowerCase().trim();
            gamesHtml += `
                <div class="game-card">
                    <div class="game-team away" style="${t1Won ? 'color: var(--correct); font-weight: 700;' : ''}">
                        <span class="seed-badge">${game.team1.seed}</span>
                        ${game.team1.name}
                        ${t1Won ? ' &#9989;' : ''}
                    </div>
                    <div class="game-score-center">
                        <div class="game-status final">FINAL</div>
                        <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">${game.region}</div>
                    </div>
                    <div class="game-team home" style="${!t1Won ? 'color: var(--correct); font-weight: 700;' : ''}">
                        ${game.team2.name}
                        ${!t1Won ? ' &#9989;' : ''}
                        <span class="seed-badge">${game.team2.seed}</span>
                    </div>
                </div>
            `;

            // Show who picked whom
            gamesHtml += `<div class="who-picked">`;
            for (const player of bracketData.participants) {
                const region = player.regions.find(r => r.name === game.region);
                if (!region) continue;
                const r32Picks = region.round_winners["Round of 32"] || [];
                const pickedWinner = r32Picks.find(p =>
                    p.toLowerCase().trim() === game.team1.name.toLowerCase().trim() ||
                    p.toLowerCase().trim() === game.team2.name.toLowerCase().trim()
                );
                const isCorrect = pickedWinner && pickedWinner.toLowerCase().trim() === game.winner.toLowerCase().trim();
                gamesHtml += `<span class="picker-badge ${isCorrect ? 'has-pick' : ''}" title="${player.name} picked ${pickedWinner || '?'}">${player.name}: ${pickedWinner || '?'} ${isCorrect ? '✓' : '✗'}</span>`;
            }
            gamesHtml += `</div><div style="margin-bottom: 12px;"></div>`;
        }
    }

    if (upcoming.length > 0) {
        gamesHtml += `<div class="game-date-header">&#128337; UPCOMING GAMES</div>`;
        for (const game of upcoming) {
            gamesHtml += `
                <div class="game-card">
                    <div class="game-team away">
                        <span class="seed-badge">${game.team1.seed}</span>
                        ${game.team1.name}
                    </div>
                    <div class="game-score-center">
                        <div class="game-status">UPCOMING</div>
                        <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">${game.region}</div>
                    </div>
                    <div class="game-team home">
                        ${game.team2.name}
                        <span class="seed-badge">${game.team2.seed}</span>
                    </div>
                </div>
            `;
        }
    }

    if (completedGames.length === 0) {
        gamesHtml = `<div class="no-games">No game data available yet. Games will appear here once the tournament begins.</div>`;
    }

    container.innerHTML = gamesHtml;
}
