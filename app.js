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

// ===== Theme Toggle =====
function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
        document.documentElement.classList.add("light");
        updateThemeIcon();
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle("light");
    const isLight = document.documentElement.classList.contains("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById("theme-toggle");
    const isLight = document.documentElement.classList.contains("light");
    btn.innerHTML = isLight ? "&#9728;" : "&#9790;";
    btn.title = isLight ? "Switch to dark mode" : "Switch to light mode";
}

document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
initTheme();

// ===== Confetti =====
function launchConfetti() {
    const container = document.getElementById("confetti-container");
    const colors = ["#f97316", "#fbbf24", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#ec4899"];
    const shapes = ["square", "circle"];
    const count = 25;

    for (let i = 0; i < count; i++) {
        const piece = document.createElement("div");
        piece.classList.add("confetti-piece");
        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const left = Math.random() * 100;
        const size = 6 + Math.random() * 8;
        const duration = 2 + Math.random() * 2;
        const rotation = (Math.random() - 0.5) * 1080;
        const delay = Math.random() * 0.5;

        piece.style.left = left + "%";
        piece.style.width = size + "px";
        piece.style.height = size + "px";
        piece.style.backgroundColor = color;
        piece.style.borderRadius = shape === "circle" ? "50%" : "2px";
        piece.style.setProperty("--fall-duration", duration + "s");
        piece.style.setProperty("--rotation", rotation + "deg");
        piece.style.animationDelay = delay + "s";

        container.appendChild(piece);
        setTimeout(() => piece.remove(), (duration + delay) * 1000 + 200);
    }
}

document.getElementById("confetti-btn").addEventListener("click", launchConfetti);

// ===== Notification Banner =====
let notificationTimer = null;

function showNotification(message) {
    const banner = document.getElementById("notification-banner");
    const text = document.getElementById("notification-text");
    text.textContent = message;
    banner.classList.remove("hidden");

    if (notificationTimer) clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => dismissNotification(), 10000);
}

function dismissNotification() {
    document.getElementById("notification-banner").classList.add("hidden");
    if (notificationTimer) { clearTimeout(notificationTimer); notificationTimer = null; }
}

document.getElementById("notification-close").addEventListener("click", dismissNotification);
document.getElementById("notification-banner").addEventListener("click", (e) => {
    if (e.target.id !== "notification-close") dismissNotification();
});

// ===== Load App =====
async function loadApp() {
    try {
        const resp = await fetch("bracket_data.json?t=" + Date.now());
        bracketData = await resp.json();
        renderLeaderboard();
        renderEliminationTracker();
        renderBracketSelector();
        renderH2HSelectors();
        renderGames();
        renderStats();
        renderScoreChart();
        updateTimestamp();
        buildNotification();

        // Confetti on load if viewing leaderboard
        const leaderboardActive = document.getElementById("view-leaderboard").classList.contains("active");
        if (leaderboardActive) {
            setTimeout(() => launchConfetti(), 500);
        }
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

// ===== Build Notification from latest results =====
function buildNotification() {
    const master = bracketData.master;
    const participants = bracketData.participants;

    // Find the most recent completed game
    let latestGame = null;
    for (const region of master.regions) {
        const r32Winners = region.round_winners["Round of 32"] || [];
        for (let i = 0; i < region.matchups.length; i++) {
            const matchup = region.matchups[i];
            const winner = r32Winners.find(w =>
                w.toLowerCase().trim() === matchup[0].name.toLowerCase().trim() ||
                w.toLowerCase().trim() === matchup[1].name.toLowerCase().trim()
            );
            if (winner) {
                latestGame = { winner, region: region.name, matchup };
            }
        }
    }

    if (!latestGame) return;

    // Find who picked the winner
    const whoGotIt = [];
    for (const p of participants) {
        const pRegion = p.regions.find(r => r.name === latestGame.region);
        if (!pRegion) continue;
        const picks = pRegion.round_winners["Round of 32"] || [];
        const picked = picks.find(pk => pk.toLowerCase().trim() === latestGame.winner.toLowerCase().trim());
        if (picked) whoGotIt.push(p.name + " +1");
    }

    const msg = `\u{1F6A8} ${latestGame.winner} wins! ${whoGotIt.length > 0 ? whoGotIt.join(", ") : "Nobody picked this one!"}`;
    showNotification(msg);
}

// ===== Leaderboard =====
function renderLeaderboard() {
    const participants = [...bracketData.participants].sort((a, b) => b.score - a.score);

    let rank = 1;
    participants.forEach((p, i) => {
        if (i > 0 && p.score < participants[i - 1].score) rank = i + 1;
        p.rank = rank;
    });

    const cardsHtml = participants.slice(0, 3).map((p, i) => {
        const medals = ["&#129351;", "&#129352;", "&#129353;"];
        const classes = ["gold", "silver", "bronze"];
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
    const master = bracketData.master;
    const scoring = bracketData.scoring;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];

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
                if (masterWinners.includes(pickLower)) continue;
                if (!isTeamEliminated(pickLower, masterRegion)) {
                    maxPts += pts;
                }
            }
        }
    }

    return maxPts;
}

function isTeamEliminated(teamName, masterRegion) {
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];

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

    if (!teamInBracket) return true;

    for (let i = 0; i < roundKeys.length; i++) {
        const rk = roundKeys[i];
        const winners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());

        if (winners.length === 0) continue;

        const expectedWinners = Math.max(1, 8 >> i);

        if (winners.length >= expectedWinners) {
            if (!winners.includes(teamName)) {
                return true;
            }
        }
    }

    return false;
}

// ===== Elimination Tracker =====
function renderEliminationTracker() {
    const container = document.getElementById("elimination-tracker");
    const participants = [...bracketData.participants].sort((a, b) => b.score - a.score);
    const leaderScore = participants[0].score;

    let html = `<div class="elim-header">\u{1F480} ELIMINATION WATCH</div>`;
    html += `<div class="elim-grid">`;

    for (const p of participants) {
        const maxPossible = calculateMaxPossible(p);
        const eliminated = maxPossible < leaderScore;
        const status = eliminated ? "eliminated" : "alive";
        const badgeText = eliminated ? "\u{274C} Eliminated" : "\u{2705} Still Alive";

        html += `
            <div class="elim-card ${status}">
                <div class="elim-info">
                    <div class="elim-name">${p.name}</div>
                    <div class="elim-details">
                        Score: ${p.score} | Max possible: ${maxPossible}
                    </div>
                </div>
                <div class="elim-badge ${status}">${badgeText}</div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
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

    for (let ri = 0; ri < 4; ri++) {
        const region = source.regions[ri];
        const masterRegion = master.regions[ri];

        html += `<div class="region-bracket">`;
        html += `<div class="region-title">${region.name} REGION</div>`;

        html += `<div class="bracket-rounds-grid">`;

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
                        if (isTeamEliminated(pick.toLowerCase().trim(), masterRegion)) {
                            status = "wrong";
                        }
                    }
                } else if (!isMaster) {
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

        html += `</div>`;
        html += `</div>`;
    }

    // Final Four / Championship section
    if (!isMaster) {
        const p = source;
        let championPick = "";
        let finalistPicks = [];

        for (const region of p.regions) {
            const champ = region.round_winners["Champion"] || [];
            if (champ.length > 0) championPick = champ[0];
            const finalist = region.round_winners["Finalist"] || [];
            finalistPicks.push(...finalist);
        }

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

    let html = `<div class="picks-comparison" style="margin-top: 24px;">`;
    html += `<h3>&#128101; How Everyone Picked</h3>`;

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

// ===== Head-to-Head Comparison =====
function renderH2HSelectors() {
    const sel1 = document.getElementById("h2h-player1");
    const sel2 = document.getElementById("h2h-player2");

    let opts = `<option value="">-- Select Player --</option>`;
    for (const p of bracketData.participants) {
        opts += `<option value="${p.id}">${p.name}</option>`;
    }
    sel1.innerHTML = opts;
    sel2.innerHTML = opts;

    sel1.addEventListener("change", renderH2H);
    sel2.addEventListener("change", renderH2H);
}

function renderH2H() {
    const id1 = document.getElementById("h2h-player1").value;
    const id2 = document.getElementById("h2h-player2").value;
    const display = document.getElementById("h2h-display");

    if (!id1 || !id2 || id1 === id2) {
        display.innerHTML = id1 && id2 && id1 === id2
            ? `<p style="color: var(--text-dim); text-align: center; padding: 16px;">Please select two different players.</p>`
            : "";
        return;
    }

    const p1 = bracketData.participants.find(p => p.id === id1);
    const p2 = bracketData.participants.find(p => p.id === id2);
    if (!p1 || !p2) return;

    const max1 = calculateMaxPossible(p1);
    const max2 = calculateMaxPossible(p2);

    let html = "";

    // Summary cards
    const p1Leading = p1.score > p2.score ? "leading" : "";
    const p2Leading = p2.score > p1.score ? "leading" : "";

    html += `<div class="h2h-summary">`;
    html += `<div class="h2h-player-card ${p1Leading}">
        <div class="h2h-pname">${p1.name}</div>
        <div class="h2h-pscore">${p1.score}</div>
        <div class="h2h-plabel">points (max ${max1})</div>
    </div>`;
    html += `<div class="h2h-middle"><div class="vs-big">VS</div></div>`;
    html += `<div class="h2h-player-card ${p2Leading}">
        <div class="h2h-pname">${p2.name}</div>
        <div class="h2h-pscore">${p2.score}</div>
        <div class="h2h-plabel">points (max ${max2})</div>
    </div>`;
    html += `</div>`;

    // Region-by-region comparison
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];
    const roundLabels = ["R32", "S16", "E8", "F4", "Finals", "Champ"];

    let agreementCount = 0;
    let totalPicks = 0;
    let p1RemainingEdge = 0;
    let p2RemainingEdge = 0;

    for (let ri = 0; ri < 4; ri++) {
        const r1 = p1.regions[ri];
        const r2 = p2.regions[ri];
        const masterRegion = bracketData.master.regions[ri];

        html += `<div class="h2h-region">`;
        html += `<div class="h2h-region-title">${r1.name} Region</div>`;

        for (let rki = 0; rki < roundKeys.length; rki++) {
            const rk = roundKeys[rki];
            const picks1 = r1.round_winners[rk] || [];
            const picks2 = r2.round_winners[rk] || [];
            const maxLen = Math.max(picks1.length, picks2.length);
            if (maxLen === 0) continue;

            for (let pi = 0; pi < maxLen; pi++) {
                const pk1 = picks1[pi] || "-";
                const pk2 = picks2[pi] || "-";
                const same = pk1.toLowerCase().trim() === pk2.toLowerCase().trim();
                const diffClass = same ? "h2h-pick-same" : "h2h-pick-diff";
                totalPicks++;
                if (same) agreementCount++;

                // Check remaining edge
                if (!same) {
                    const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
                    const p1Correct = masterWinners.includes(pk1.toLowerCase().trim());
                    const p2Correct = masterWinners.includes(pk2.toLowerCase().trim());
                    if (!p1Correct && !p2Correct) {
                        // Both pending or both wrong - check if still alive
                        const p1Alive = pk1 !== "-" && !isTeamEliminated(pk1.toLowerCase().trim(), masterRegion);
                        const p2Alive = pk2 !== "-" && !isTeamEliminated(pk2.toLowerCase().trim(), masterRegion);
                        if (p1Alive && !p2Alive) p1RemainingEdge++;
                        if (p2Alive && !p1Alive) p2RemainingEdge++;
                    }
                }

                html += `<div class="h2h-picks-row">
                    <div class="h2h-pick-left ${diffClass}">${pk1}</div>
                    <div class="h2h-round-label">${roundLabels[rki]}</div>
                    <div class="h2h-pick-right ${diffClass}">${pk2}</div>
                </div>`;
            }
        }

        html += `</div>`;
    }

    // Edge in remaining picks
    const totalEdge = p1RemainingEdge + p2RemainingEdge;
    html += `<div class="h2h-edge-section">`;
    html += `<div class="h2h-edge-title">Edge in Remaining Picks (where picks differ & one team is alive, the other eliminated)</div>`;
    if (totalEdge > 0) {
        const p1Pct = Math.round((p1RemainingEdge / totalEdge) * 100);
        const p2Pct = 100 - p1Pct;
        html += `<div class="h2h-edge-bar">
            <div class="h2h-edge-fill p1" style="width: ${p1Pct}%">${p1.name} ${p1RemainingEdge}</div>
            <div class="h2h-edge-fill p2" style="width: ${p2Pct}%">${p2.name} ${p2RemainingEdge}</div>
        </div>`;
    } else {
        html += `<p style="color: var(--text-dim); font-size: 13px;">No clear edge - picks are even or all still pending.</p>`;
    }
    html += `<p style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">Agreement rate: ${totalPicks > 0 ? Math.round((agreementCount / totalPicks) * 100) : 0}% (${agreementCount}/${totalPicks} picks match)</p>`;
    html += `</div>`;

    display.innerHTML = html;
}

// ===== Games View =====
function renderGames() {
    const container = document.getElementById("games-list");

    const master = bracketData.master;
    let gamesHtml = "";

    const completedGames = [];

    for (const region of master.regions) {
        const r32Winners = region.round_winners["Round of 32"] || [];

        for (let i = 0; i < region.matchups.length; i++) {
            const matchup = region.matchups[i];
            const team1 = matchup[0];
            const team2 = matchup[1];

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
                gamesHtml += `<span class="picker-badge ${isCorrect ? 'has-pick' : ''}" title="${player.name} picked ${pickedWinner || '?'}">${player.name}: ${pickedWinner || '?'} ${isCorrect ? '\u2713' : '\u2717'}</span>`;
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

// ===== Fun Stats =====
function renderStats() {
    const container = document.getElementById("stats-cards");
    const participants = bracketData.participants;
    const master = bracketData.master;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];
    const roundLabels = ["R32", "S16", "E8", "F4", "Finals", "Champ"];
    const scoringValues = Object.values(bracketData.scoring);

    const stats = [];

    // 1. Most Popular Pick per round
    const popularByRound = {};
    for (const rk of roundKeys) {
        const pickCounts = {};
        for (const p of participants) {
            for (const region of p.regions) {
                const picks = region.round_winners[rk] || [];
                for (const pick of picks) {
                    const key = pick.toLowerCase().trim();
                    pickCounts[key] = pickCounts[key] || { name: pick, count: 0 };
                    pickCounts[key].count++;
                }
            }
        }
        const sorted = Object.values(pickCounts).sort((a, b) => b.count - a.count);
        if (sorted.length > 0) {
            popularByRound[rk] = sorted[0];
        }
    }

    let popularDetail = "";
    for (const rk of roundKeys) {
        if (popularByRound[rk]) {
            const ri = roundKeys.indexOf(rk);
            popularDetail += `${roundLabels[ri]}: ${popularByRound[rk].name} (${popularByRound[rk].count}/${participants.length})\n`;
        }
    }
    stats.push({
        icon: "\u{1F525}",
        title: "Most Popular Picks",
        value: popularByRound[roundKeys[0]] ? popularByRound[roundKeys[0]].name : "N/A",
        detail: popularDetail.trim().replace(/\n/g, " | ")
    });

    // 2. Biggest Contrarian - most unique picks nobody else made
    const contrarianScores = {};
    for (const p of participants) {
        contrarianScores[p.id] = { name: p.name, uniquePicks: 0 };
        for (const rk of roundKeys) {
            for (const region of p.regions) {
                const picks = region.round_winners[rk] || [];
                for (const pick of picks) {
                    const pickLower = pick.toLowerCase().trim();
                    let othersPicked = 0;
                    for (const op of participants) {
                        if (op.id === p.id) continue;
                        for (const or2 of op.regions) {
                            const oPicks = or2.round_winners[rk] || [];
                            if (oPicks.some(op2 => op2.toLowerCase().trim() === pickLower)) {
                                othersPicked++;
                                break;
                            }
                        }
                    }
                    if (othersPicked === 0) contrarianScores[p.id].uniquePicks++;
                }
            }
        }
    }
    const contrarian = Object.values(contrarianScores).sort((a, b) => b.uniquePicks - a.uniquePicks)[0];
    stats.push({
        icon: "\u{1F60E}",
        title: "Biggest Contrarian",
        value: contrarian ? contrarian.name : "N/A",
        detail: contrarian ? `${contrarian.uniquePicks} picks that nobody else made` : ""
    });

    // 3. Best Upset Picker
    const upsetScores = {};
    for (const p of participants) {
        upsetScores[p.id] = { name: p.name, upsets: 0 };
        for (let ri = 0; ri < 4; ri++) {
            const region = p.regions[ri];
            const masterRegion = master.regions[ri];
            for (const rk of roundKeys) {
                const picks = region.round_winners[rk] || [];
                const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
                for (const pick of picks) {
                    if (masterWinners.includes(pick.toLowerCase().trim())) {
                        const seed = findTeamSeed(pick, region) || findTeamSeed(pick, masterRegion);
                        if (seed && parseInt(seed) > 4) {
                            upsetScores[p.id].upsets++;
                        }
                    }
                }
            }
        }
    }
    const upsetKing = Object.values(upsetScores).sort((a, b) => b.upsets - a.upsets)[0];
    stats.push({
        icon: "\u{1F4A5}",
        title: "Best Upset Picker",
        value: upsetKing ? upsetKing.name : "N/A",
        detail: upsetKing ? `${upsetKing.upsets} correct underdog picks (seed 5+)` : ""
    });

    // 4. Worst Round
    let worstRound = { name: "N/A", round: "", wrong: 0 };
    for (const p of participants) {
        for (let rki = 0; rki < roundKeys.length; rki++) {
            const rk = roundKeys[rki];
            let wrongCount = 0;
            let totalPicks = 0;
            for (let ri = 0; ri < 4; ri++) {
                const region = p.regions[ri];
                const masterRegion = master.regions[ri];
                const picks = region.round_winners[rk] || [];
                const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
                if (masterWinners.length === 0) continue;
                for (const pick of picks) {
                    totalPicks++;
                    if (!masterWinners.includes(pick.toLowerCase().trim())) {
                        wrongCount++;
                    }
                }
            }
            if (totalPicks > 0 && wrongCount > worstRound.wrong) {
                worstRound = { name: p.name, round: roundLabels[rki], wrong: wrongCount, total: totalPicks };
            }
        }
    }
    stats.push({
        icon: "\u{1F62C}",
        title: "Worst Round",
        value: worstRound.name,
        detail: worstRound.wrong > 0 ? `${worstRound.wrong} wrong picks in ${worstRound.round}` : "No completed rounds yet"
    });

    // 5. Chalk Picker - who picked the most favorites (1-4 seeds)
    const chalkScores = {};
    for (const p of participants) {
        chalkScores[p.id] = { name: p.name, chalk: 0 };
        for (const rk of roundKeys) {
            for (const region of p.regions) {
                const picks = region.round_winners[rk] || [];
                for (const pick of picks) {
                    const seed = findTeamSeed(pick, region);
                    if (seed && parseInt(seed) >= 1 && parseInt(seed) <= 4) {
                        chalkScores[p.id].chalk++;
                    }
                }
            }
        }
    }
    const chalkKing = Object.values(chalkScores).sort((a, b) => b.chalk - a.chalk)[0];
    stats.push({
        icon: "\u{1F4CF}",
        title: "Chalk Picker",
        value: chalkKing ? chalkKing.name : "N/A",
        detail: chalkKing ? `${chalkKing.chalk} favorites picked (seeds 1-4)` : ""
    });

    // Render stat cards
    let html = "";
    for (const stat of stats) {
        html += `
            <div class="stat-card">
                <div class="stat-card-icon">${stat.icon}</div>
                <div class="stat-card-title">${stat.title}</div>
                <div class="stat-card-value">${stat.value}</div>
                <div class="stat-card-detail">${stat.detail}</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ===== Score Progression Chart =====
function renderScoreChart() {
    const chartContainer = document.getElementById("score-chart");
    const legendContainer = document.getElementById("chart-legend");
    const participants = bracketData.participants;
    const master = bracketData.master;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];
    const roundLabels = ["R32", "S16", "E8", "F4", "Finals", "Champ"];
    const scoringValues = Object.values(bracketData.scoring);

    // Determine which rounds have been played
    const playedRounds = [];
    for (let rki = 0; rki < roundKeys.length; rki++) {
        const rk = roundKeys[rki];
        let hasResults = false;
        for (const region of master.regions) {
            if ((region.round_winners[rk] || []).length > 0) {
                hasResults = true;
                break;
            }
        }
        if (hasResults) playedRounds.push({ key: rk, label: roundLabels[rki], index: rki });
    }

    if (playedRounds.length === 0) {
        chartContainer.innerHTML = `<p style="text-align: center; color: var(--text-dim); padding: 40px;">No rounds completed yet. Chart will appear as games are played.</p>`;
        legendContainer.innerHTML = "";
        return;
    }

    // Calculate cumulative scores per round per player
    const colors = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#fbbf24", "#ec4899", "#06b6d4"];
    const playerData = participants.map((p, idx) => {
        let cumulative = 0;
        const scores = [];
        for (const pr of playedRounds) {
            let roundScore = 0;
            for (let ri = 0; ri < 4; ri++) {
                const pickRegion = p.regions[ri];
                const masterRegion = master.regions[ri];
                const picks = pickRegion.round_winners[pr.key] || [];
                const masterWinners = (masterRegion.round_winners[pr.key] || []).map(w => w.toLowerCase().trim());
                for (const pick of picks) {
                    if (masterWinners.includes(pick.toLowerCase().trim())) {
                        roundScore += scoringValues[pr.index] || 0;
                    }
                }
            }
            cumulative += roundScore;
            scores.push(cumulative);
        }
        return { name: p.name, scores, color: colors[idx % colors.length] };
    });

    // Find max score for chart scaling
    const maxScore = Math.max(...playerData.flatMap(d => d.scores), 1);
    const numRounds = playedRounds.length;

    // Build SVG
    const svgW = 800;
    const svgH = 280;
    const padL = 50;
    const padR = 20;
    const padT = 20;
    const padB = 40;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;

    let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">`;

    // Grid lines and Y-axis labels
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const y = padT + (chartH / yTicks) * i;
        const val = Math.round(maxScore * (1 - i / yTicks));
        svg += `<line x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
        svg += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-dim)" font-size="11" font-family="var(--font)">${val}</text>`;
    }

    // X-axis labels
    for (let i = 0; i < numRounds; i++) {
        const x = padL + (chartW / Math.max(numRounds - 1, 1)) * i;
        const y = svgH - 8;
        svg += `<text x="${x}" y="${y}" text-anchor="middle" fill="var(--text-dim)" font-size="11" font-family="var(--font)">${playedRounds[i].label}</text>`;
    }

    // Draw lines and dots per player
    for (const pd of playerData) {
        const points = pd.scores.map((s, i) => {
            const x = padL + (chartW / Math.max(numRounds - 1, 1)) * i;
            const y = padT + chartH - (s / maxScore) * chartH;
            return { x, y };
        });

        // Line
        if (points.length > 1) {
            const pathD = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(" ");
            svg += `<path d="${pathD}" fill="none" stroke="${pd.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        }

        // Dots
        for (const pt of points) {
            svg += `<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="${pd.color}" stroke="var(--bg-card)" stroke-width="2"/>`;
        }

        // End label
        if (points.length > 0) {
            const last = points[points.length - 1];
            svg += `<text x="${last.x + 8}" y="${last.y + 4}" fill="${pd.color}" font-size="11" font-weight="600" font-family="var(--font)">${pd.scores[pd.scores.length - 1]}</text>`;
        }
    }

    svg += `</svg>`;
    chartContainer.innerHTML = svg;

    // Legend
    let legendHtml = "";
    for (const pd of playerData) {
        legendHtml += `<div class="legend-entry"><div class="legend-swatch" style="background: ${pd.color}"></div>${pd.name}</div>`;
    }
    legendContainer.innerHTML = legendHtml;
}
