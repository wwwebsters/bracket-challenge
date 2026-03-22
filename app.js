// Webster Family Bracket Challenge 2026
let bracketData = null;

// Pronouns for family members
const PRONOUNS = {
    "Dad": { subject: "he", object: "him", possessive: "his" },
    "Mom": { subject: "she", object: "her", possessive: "her" },
    "Jared": { subject: "he", object: "him", possessive: "his" },
    "Megan": { subject: "she", object: "her", possessive: "her" },
    "Lauren": { subject: "she", object: "her", possessive: "her" },
    "Gavin": { subject: "he", object: "him", possessive: "his" },
    "Molly": { subject: "she", object: "her", possessive: "her" },
};
function pronoun(name, type) { return (PRONOUNS[name] || { subject: "they", object: "them", possessive: "their" })[type]; }

// Auto-load app (no password required)
document.getElementById("password-gate").classList.add("hidden");
document.getElementById("app").classList.remove("hidden");
document.getElementById("app-footer").classList.remove("hidden");
loadApp();

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
    notificationTimer = setTimeout(() => dismissNotification(), 20000);
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
        renderDailyRecap();
        renderLeaderboard();
        renderBracketBustedMeter();
        renderEliminationTracker();
        renderBracketSelector();
        renderH2HSelectors();
        renderGames();
        renderStats();
        renderRegionMiniLeaderboards();
        renderScoreChart();
        // renderTrashTalkTicker(); // removed
        updateTimestamp();
        buildNotification();
        initShareButton();

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

// Auto-refresh every 10 minutes
setInterval(loadApp, 10 * 60 * 1000);

function updateTimestamp() {
    const now = new Date();
    document.getElementById("last-updated").textContent =
        `Updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
}

// ===== Build Notification from latest results =====
let previousWinnerKeys = null; // track known winners across refreshes

function buildNotification() {
    const master = bracketData.master;
    const participants = bracketData.participants;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];
    const roundLabelsNotif = ["R64", "R32", "Sweet 16", "Elite 8", "Final Four", "Championship"];
    const roundPoints = [1, 2, 3, 4, 5, 6];

    // Build a set of all current winners across all regions/rounds
    const currentWinnerKeys = new Set();
    const allNewWinners = [];
    for (const region of master.regions) {
        for (let ri = 0; ri < roundKeys.length; ri++) {
            const winners = region.round_winners[roundKeys[ri]] || [];
            for (const w of winners) {
                const key = `${region.name}|${roundKeys[ri]}|${w.toLowerCase().trim()}`;
                currentWinnerKeys.add(key);
                if (previousWinnerKeys && !previousWinnerKeys.has(key)) {
                    allNewWinners.push({ winner: w, roundKey: roundKeys[ri], roundIdx: ri, regionName: region.name });
                }
            }
        }
    }

    const isFirstLoad = !previousWinnerKeys;

    if (isFirstLoad) {
        previousWinnerKeys = currentWinnerKeys;
        // On first load, show ALL winners from the highest completed round
        // Find the highest round that has results
        let highestRound = -1;
        for (const region of master.regions) {
            for (let ri = roundKeys.length - 1; ri >= 0; ri--) {
                const winners = region.round_winners[roundKeys[ri]] || [];
                if (winners.length > 0 && ri > highestRound) {
                    highestRound = ri;
                }
            }
        }
        if (highestRound < 0) return;
        // Collect all winners from that round across all regions
        allNewWinners.length = 0;
        for (const region of master.regions) {
            const winners = region.round_winners[roundKeys[highestRound]] || [];
            for (const w of winners) {
                allNewWinners.push({ winner: w, roundKey: roundKeys[highestRound], roundIdx: highestRound, regionName: region.name });
            }
        }
        if (allNewWinners.length === 0) return;
    } else {
        previousWinnerKeys = currentWinnerKeys;
        if (allNewWinners.length === 0) return;
    }

    // Build notification messages
    const messages = [];
    for (const nw of allNewWinners) {
        const pts = roundPoints[nw.roundIdx] || 1;
        const whoGotIt = [];
        for (const p of participants) {
            const pRegion = p.regions.find(r => r.name === nw.regionName);
            if (!pRegion) continue;
            const picks = pRegion.round_winners[nw.roundKey] || [];
            if (picks.some(pk => pk.toLowerCase().trim() === nw.winner.toLowerCase().trim())) {
                whoGotIt.push(p.name + " +" + pts);
            }
        }
        const roundLabel = roundLabelsNotif[nw.roundIdx];
        messages.push(`\u{1F6A8} ${nw.winner} advances (${roundLabel})! ${whoGotIt.length > 0 ? whoGotIt.join(", ") : "Nobody picked this one!"}`);
    }

    showNotification(messages.join(" \u{1F3C0} "));
}

// ===== Leaderboard =====
function renderLeaderboard() {
    const participants = [...bracketData.participants].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return calculateMaxPossible(b) - calculateMaxPossible(a);
    });

    let rank = 1;
    participants.forEach((p, i) => {
        if (i > 0 && (p.score < participants[i - 1].score || calculateMaxPossible(p) < calculateMaxPossible(participants[i - 1]))) rank = i + 1;
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

        const laterRounds = ["Round of 32", "Sweet 16", "Elite 8"];
        const laterLabels = ["R32", "S16", "E8"];

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
        const regionNames = p.regions.map(r => r.name);

        // Get Final Four picks — one per region
        const f4Picks = p.regions.map(r => {
            const f4 = r.round_winners["Final Four"] || [];
            return f4.length > 0 ? f4[0] : null;
        });

        // Helper: find which region a team actually belongs to
        function findTeamRegionName(teamName, player) {
            const tLower = teamName.toLowerCase().trim();
            for (let ri = 0; ri < 4; ri++) {
                for (const matchup of player.regions[ri].matchups) {
                    for (const team of matchup) {
                        if (team.name.toLowerCase().trim() === tLower) return player.regions[ri].name;
                    }
                }
            }
            return "";
        }

        // Finalists — collect from all regions, deduplicate
        const allFinalists = [];
        for (const region of p.regions) {
            const f = region.round_winners["Finalist"] || [];
            for (const name of f) {
                if (!allFinalists.includes(name)) allFinalists.push(name);
            }
        }

        // Champion
        let championPick = null;
        for (const region of p.regions) {
            const c = region.round_winners["Champion"] || [];
            if (c.length > 0) championPick = c[0];
        }

        html += `<div class="final-four-section">`;
        html += `<div class="final-four-title">&#127942; FINAL FOUR & CHAMPIONSHIP</div>`;

        // Final Four — show all 4 teams with their actual region
        // NCAA semifinal pairing: East(0) vs South(2), West(1) vs Midwest(3)
        html += `<div class="semifinal-bracket">`;

        // Semifinal 1: East vs South (regions 0 and 2)
        html += `<div class="semifinal-matchup">`;
        html += `<div class="semi-label">${regionNames[0]} vs ${regionNames[2]}</div>`;
        if (f4Picks[0]) {
            const seed0 = findTeamSeedGlobal(f4Picks[0], p);
            html += `<div class="bracket-team pending">${seed0 ? `<span class="seed">${seed0}</span>` : ""}${f4Picks[0]} <span class="region-tag">${regionNames[0]}</span></div>`;
        }
        if (f4Picks[2]) {
            const seed2 = findTeamSeedGlobal(f4Picks[2], p);
            html += `<div class="bracket-team pending">${seed2 ? `<span class="seed">${seed2}</span>` : ""}${f4Picks[2]} <span class="region-tag">${regionNames[2]}</span></div>`;
        }
        html += `</div>`;

        // Semifinal 2: West vs Midwest (regions 1 and 3)
        html += `<div class="semifinal-matchup">`;
        html += `<div class="semi-label">${regionNames[1]} vs ${regionNames[3]}</div>`;
        if (f4Picks[1]) {
            const seed1 = findTeamSeedGlobal(f4Picks[1], p);
            html += `<div class="bracket-team pending">${seed1 ? `<span class="seed">${seed1}</span>` : ""}${f4Picks[1]} <span class="region-tag">${regionNames[1]}</span></div>`;
        }
        if (f4Picks[3]) {
            const seed3 = findTeamSeedGlobal(f4Picks[3], p);
            html += `<div class="bracket-team pending">${seed3 ? `<span class="seed">${seed3}</span>` : ""}${f4Picks[3]} <span class="region-tag">${regionNames[3]}</span></div>`;
        }
        html += `</div>`;
        html += `</div>`;

        // Championship — show the two finalists with their actual regions
        if (allFinalists.length > 0) {
            html += `<div class="championship-matchup">`;
            html += `<div class="semi-label">Championship</div>`;
            for (const finalist of allFinalists) {
                const regionTag = findTeamRegionName(finalist, p);
                const seed = findTeamSeedGlobal(finalist, p);
                html += `<div class="bracket-team pending">${seed ? `<span class="seed">${seed}</span>` : ""}${finalist}${regionTag ? ` <span class="region-tag">${regionTag}</span>` : ""}</div>`;
            }
            html += `</div>`;
        }

        if (championPick) {
            const champRegion = findTeamRegionName(championPick, p);
            html += `
                <div class="champion-box">
                    <div class="champion-label">&#128081; CHAMPION PICK</div>
                    <div class="champion-team pending">${championPick}${champRegion ? ` <span class="region-tag" style="font-size: 12px;">${champRegion}</span>` : ""}</div>
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
function getSeedForTeam(teamName) {
    const master = bracketData.master;
    for (const region of master.regions) {
        for (const matchup of region.matchups) {
            if (matchup[0].name.toLowerCase().trim() === teamName.toLowerCase().trim()) return matchup[0].seed;
            if (matchup[1].name.toLowerCase().trim() === teamName.toLowerCase().trim()) return matchup[1].seed;
        }
    }
    return "?";
}

function getRegionForTeam(teamName) {
    const master = bracketData.master;
    for (const region of master.regions) {
        for (const matchup of region.matchups) {
            if (matchup[0].name.toLowerCase().trim() === teamName.toLowerCase().trim()) return region.name;
            if (matchup[1].name.toLowerCase().trim() === teamName.toLowerCase().trim()) return region.name;
        }
    }
    return "";
}

function getWinnerOfMatchup(region, matchup) {
    const r32Winners = region.round_winners["Round of 32"] || [];
    return r32Winners.find(w =>
        w.toLowerCase().trim() === matchup[0].name.toLowerCase().trim() ||
        w.toLowerCase().trim() === matchup[1].name.toLowerCase().trim()
    ) || null;
}

function renderGames() {
    const container = document.getElementById("games-list");
    const master = bracketData.master;
    const allGames = [];

    for (const region of master.regions) {
        const matchups = region.matchups; // 8 matchups in bracket order

        // === ROUND OF 64 ===
        // Original 8 matchups, winners go to "Round of 32"
        const r32Winners = region.round_winners["Round of 32"] || [];
        const r64WinnersBySlot = []; // Track winner per matchup slot

        for (let i = 0; i < matchups.length; i++) {
            const t1 = matchups[i][0];
            const t2 = matchups[i][1];
            const winner = r32Winners.find(w =>
                w.toLowerCase().trim() === t1.name.toLowerCase().trim() ||
                w.toLowerCase().trim() === t2.name.toLowerCase().trim()
            ) || null;
            r64WinnersBySlot[i] = winner;

            allGames.push({
                team1Name: t1.name, team1Seed: t1.seed,
                team2Name: t2.name, team2Seed: t2.seed,
                winner, region: region.name,
                roundDisplay: "Round of 64", roundKey: "Round of 32", roundSortOrder: 6
            });
        }

        // === ROUND OF 32 ===
        // Bracket pairings: matchup 0 winner vs matchup 1 winner, 2 vs 3, 4 vs 5, 6 vs 7
        const s16Winners = region.round_winners["Sweet 16"] || [];
        const r32WinnersBySlot = [];

        for (let i = 0; i < 8; i += 2) {
            const t1 = r64WinnersBySlot[i];
            const t2 = r64WinnersBySlot[i + 1];
            if (!t1 || !t2) continue; // Both teams must have won R64

            const winner = s16Winners.find(w =>
                w.toLowerCase().trim() === t1.toLowerCase().trim() ||
                w.toLowerCase().trim() === t2.toLowerCase().trim()
            ) || null;
            r32WinnersBySlot[i / 2] = winner;

            allGames.push({
                team1Name: t1, team1Seed: getSeedForTeam(t1),
                team2Name: t2, team2Seed: getSeedForTeam(t2),
                winner, region: region.name,
                roundDisplay: "Round of 32", roundKey: "Sweet 16", roundSortOrder: 5
            });
        }

        // === SWEET 16 ===
        // Pairings: R32 slot 0 winner vs slot 1 winner, slot 2 vs slot 3
        const e8Winners = region.round_winners["Elite 8"] || [];
        const s16WinnersBySlot = [];

        for (let i = 0; i < 4; i += 2) {
            const t1 = r32WinnersBySlot[i];
            const t2 = r32WinnersBySlot[i + 1];
            if (!t1 || !t2) continue;

            const winner = e8Winners.find(w =>
                w.toLowerCase().trim() === t1.toLowerCase().trim() ||
                w.toLowerCase().trim() === t2.toLowerCase().trim()
            ) || null;
            s16WinnersBySlot[i / 2] = winner;

            allGames.push({
                team1Name: t1, team1Seed: getSeedForTeam(t1),
                team2Name: t2, team2Seed: getSeedForTeam(t2),
                winner, region: region.name,
                roundDisplay: "Sweet 16", roundKey: "Elite 8", roundSortOrder: 4
            });
        }

        // === ELITE 8 ===
        const f4Winners = region.round_winners["Final Four"] || [];
        if (s16WinnersBySlot[0] && s16WinnersBySlot[1]) {
            const t1 = s16WinnersBySlot[0];
            const t2 = s16WinnersBySlot[1];
            const winner = f4Winners.find(w =>
                w.toLowerCase().trim() === t1.toLowerCase().trim() ||
                w.toLowerCase().trim() === t2.toLowerCase().trim()
            ) || null;

            allGames.push({
                team1Name: t1, team1Seed: getSeedForTeam(t1),
                team2Name: t2, team2Seed: getSeedForTeam(t2),
                winner, region: region.name,
                roundDisplay: "Elite 8", roundKey: "Final Four", roundSortOrder: 3
            });
        }
    }

    // Separate and sort
    const completed = allGames.filter(g => g.winner);
    const upcoming = allGames.filter(g => !g.winner && g.team1Name && g.team2Name);

    completed.sort((a, b) => a.roundSortOrder - b.roundSortOrder);
    upcoming.sort((a, b) => a.roundSortOrder - b.roundSortOrder);

    let gamesHtml = "";

    // Render upcoming first (always expanded)
    if (upcoming.length > 0) {
        const upcomingByRound = {};
        for (const g of upcoming) {
            if (!upcomingByRound[g.roundDisplay]) upcomingByRound[g.roundDisplay] = [];
            upcomingByRound[g.roundDisplay].push(g);
        }
        for (const [roundName, games] of Object.entries(upcomingByRound)) {
            gamesHtml += `<div class="game-date-header">&#128337; UPCOMING - ${roundName.toUpperCase()} (${games.length})</div>`;
            for (const game of games) {
                gamesHtml += `
                    <div class="game-card">
                        <div class="game-team away">
                            <span class="seed-badge">${game.team1Seed}</span>
                            ${game.team1Name}
                        </div>
                        <div class="game-score-center">
                            <div class="game-status">UPCOMING</div>
                            <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">${game.region}</div>
                        </div>
                        <div class="game-team home">
                            ${game.team2Name}
                            <span class="seed-badge">${game.team2Seed}</span>
                        </div>
                    </div>
                `;
            }
        }
    }

    // Render completed (collapsible — latest round expanded, older rounds collapsed)
    if (completed.length > 0) {
        const completedByRound = {};
        for (const g of completed) {
            if (!completedByRound[g.roundDisplay]) completedByRound[g.roundDisplay] = [];
            completedByRound[g.roundDisplay].push(g);
        }
        const roundNames = Object.keys(completedByRound);
        for (let ri = 0; ri < roundNames.length; ri++) {
            const roundName = roundNames[ri];
            const games = completedByRound[roundName];
            const isLatestRound = ri === 0;
            const sectionId = `games-section-${roundName.replace(/\s+/g, '-').toLowerCase()}`;
            gamesHtml += `<div class="game-date-header collapsible" onclick="toggleGamesSection('${sectionId}')">&#9989; COMPLETED - ${roundName.toUpperCase()} (${games.length}) <span class="collapse-icon" id="icon-${sectionId}">${isLatestRound ? '&#9660;' : '&#9654;'}</span></div>`;
            gamesHtml += `<div id="${sectionId}" class="games-collapsible-section" style="display: ${isLatestRound ? 'block' : 'none'};">`;
            for (const game of games) {
                const t1Won = game.winner.toLowerCase().trim() === game.team1Name.toLowerCase().trim();
                gamesHtml += `
                    <div class="game-card">
                        <div class="game-team away" style="${t1Won ? 'color: var(--correct); font-weight: 700;' : ''}">
                            <span class="seed-badge">${game.team1Seed}</span>
                            ${game.team1Name}
                            ${t1Won ? ' &#9989;' : ''}
                        </div>
                        <div class="game-score-center">
                            <div class="game-status final">FINAL</div>
                            <div style="font-size: 10px; color: var(--text-dim); margin-top: 2px;">${game.region}</div>
                        </div>
                        <div class="game-team home" style="${!t1Won ? 'color: var(--correct); font-weight: 700;' : ''}">
                            ${game.team2Name}
                            ${!t1Won ? ' &#9989;' : ''}
                            <span class="seed-badge">${game.team2Seed}</span>
                        </div>
                    </div>
                `;

                gamesHtml += `<div class="who-picked">`;
                for (const player of bracketData.participants) {
                    const region = player.regions.find(r => r.name === game.region);
                    if (!region) continue;
                    const picks = region.round_winners[game.roundKey] || [];
                    const pickedWinner = picks.find(p =>
                        p.toLowerCase().trim() === game.team1Name.toLowerCase().trim() ||
                        p.toLowerCase().trim() === game.team2Name.toLowerCase().trim()
                    );
                    const isCorrect = pickedWinner && pickedWinner.toLowerCase().trim() === game.winner.toLowerCase().trim();
                    gamesHtml += `<span class="picker-badge ${isCorrect ? 'has-pick' : ''}" title="${player.name} picked ${pickedWinner || '?'}">${player.name}: ${pickedWinner || '?'} ${isCorrect ? '\u2713' : '\u2717'}</span>`;
                }
                gamesHtml += `</div><div style="margin-bottom: 12px;"></div>`;
            }
            gamesHtml += `</div>`; // close collapsible section
        }
    }

    if (allGames.length === 0) {
        gamesHtml = `<div class="no-games">No game data available yet.</div>`;
    }

    container.innerHTML = gamesHtml;
}

function toggleGamesSection(sectionId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById("icon-" + sectionId);
    if (section.style.display === "none") {
        section.style.display = "block";
        icon.innerHTML = "&#9660;"; // down arrow
    } else {
        section.style.display = "none";
        icon.innerHTML = "&#9654;"; // right arrow
    }
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

    // 4. Worst Round — only count a pick as wrong if that team is eliminated
    let worstRound = { name: "N/A", round: "", wrong: 0 };
    for (const p of participants) {
        for (let rki = 0; rki < roundKeys.length; rki++) {
            const rk = roundKeys[rki];
            let wrongCount = 0;
            let decidedCount = 0;
            for (let ri = 0; ri < 4; ri++) {
                const region = p.regions[ri];
                const masterRegion = master.regions[ri];
                const picks = region.round_winners[rk] || [];
                const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
                for (const pick of picks) {
                    const pickLower = pick.toLowerCase().trim();
                    // Only count this pick if the game has been decided:
                    // Either the pick IS a winner (correct) or the pick's team is eliminated
                    if (masterWinners.includes(pickLower)) {
                        decidedCount++;
                    } else if (isTeamEliminated(pickLower, masterRegion)) {
                        decidedCount++;
                        wrongCount++;
                    }
                    // If neither, the game hasn't been played yet — skip
                }
            }
            if (decidedCount > 0 && wrongCount > worstRound.wrong) {
                worstRound = { name: p.name, round: roundLabels[rki], wrong: wrongCount, total: decidedCount };
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

    // 6. Heartbreak Index — who has the most picks eliminated (bracket busted)
    const heartbreakScores = {};
    for (const p of participants) {
        let eliminated = 0;
        for (let ri = 0; ri < 4; ri++) {
            const masterRegion = master.regions[ri];
            const pickRegion = p.regions[ri];
            for (const rk of roundKeys) {
                const picks = pickRegion.round_winners[rk] || [];
                for (const pick of picks) {
                    if (isTeamEliminated(pick.toLowerCase().trim(), masterRegion)) {
                        eliminated++;
                    }
                }
            }
        }
        heartbreakScores[p.name] = eliminated;
    }
    const heartbreakKing = Object.entries(heartbreakScores).sort((a, b) => b[1] - a[1])[0];
    stats.push({
        icon: "\u{1F494}",
        title: "Heartbreak Index",
        value: heartbreakKing ? heartbreakKing[0] : "N/A",
        detail: heartbreakKing ? `${heartbreakKing[1]} picks eliminated \u2014 most busted bracket` : ""
    });

    // 7. Hivemind Score — what % of the family picked the same R64 winner
    let unanimousGames = 0;
    let splitGames = 0;
    let totalGamesChecked = 0;
    for (let ri = 0; ri < 4; ri++) {
        const masterRegion = master.regions[ri];
        const r32Winners = masterRegion.round_winners["Round of 32"] || [];
        for (const matchup of masterRegion.matchups) {
            const t1 = matchup[0].name.toLowerCase().trim();
            const t2 = matchup[1].name.toLowerCase().trim();
            const winner = r32Winners.find(w => w.toLowerCase().trim() === t1 || w.toLowerCase().trim() === t2);
            if (!winner) continue;
            totalGamesChecked++;
            let pickedWinnerCount = 0;
            for (const p of participants) {
                const picks = p.regions[ri].round_winners["Round of 32"] || [];
                const picked = picks.find(pk => pk.toLowerCase().trim() === winner.toLowerCase().trim());
                if (picked) pickedWinnerCount++;
            }
            if (pickedWinnerCount === participants.length) unanimousGames++;
            if (pickedWinnerCount <= Math.floor(participants.length / 2)) splitGames++;
        }
    }
    stats.push({
        icon: "\u{1F9E0}",
        title: "Hivemind Score",
        value: totalGamesChecked > 0 ? `${Math.round((unanimousGames / totalGamesChecked) * 100)}%` : "N/A",
        detail: totalGamesChecked > 0 ? `${unanimousGames} unanimous picks, ${splitGames} split decisions out of ${totalGamesChecked} games` : ""
    });

    // 8. Cinderella Tracker — who picked the lowest seed to go the furthest
    let cinderellaKing = { name: "N/A", team: "", seed: 0, round: "" };
    for (const p of participants) {
        for (let rki = roundKeys.length - 1; rki >= 0; rki--) {
            const rk = roundKeys[rki];
            for (const region of p.regions) {
                const picks = region.round_winners[rk] || [];
                for (const pick of picks) {
                    const seed = findTeamSeed(pick, region);
                    if (seed && parseInt(seed) > cinderellaKing.seed) {
                        cinderellaKing = { name: p.name, team: pick, seed: parseInt(seed), round: roundLabels[rki] };
                    }
                }
            }
        }
    }
    stats.push({
        icon: "\u{1F451}",
        title: "Cinderella Tracker",
        value: cinderellaKing.name,
        detail: cinderellaKing.seed > 0 ? `Picked ${cinderellaKing.seed}-seed ${cinderellaKing.team} to reach the ${cinderellaKing.round}` : "No Cinderella picks yet"
    });

    // 9. Agreement Matrix — find the two most similar brackets
    let maxAgreement = 0;
    let agreePair = ["", ""];
    let minAgreement = 999;
    let disagreePair = ["", ""];
    for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
            let agree = 0;
            let total = 0;
            for (let ri = 0; ri < 4; ri++) {
                for (const rk of roundKeys) {
                    const picks1 = participants[i].regions[ri].round_winners[rk] || [];
                    const picks2 = participants[j].regions[ri].round_winners[rk] || [];
                    for (const pk of picks1) {
                        total++;
                        if (picks2.some(p2 => p2.toLowerCase().trim() === pk.toLowerCase().trim())) agree++;
                    }
                }
            }
            if (total > 0) {
                const pct = agree / total;
                if (pct > maxAgreement) { maxAgreement = pct; agreePair = [participants[i].name, participants[j].name]; }
                if (pct < minAgreement) { minAgreement = pct; disagreePair = [participants[i].name, participants[j].name]; }
            }
        }
    }
    stats.push({
        icon: "\u{1F91D}",
        title: "Bracket Twins",
        value: `${agreePair[0]} & ${agreePair[1]}`,
        detail: `${Math.round(maxAgreement * 100)}% agreement \u2014 Most different: ${disagreePair[0]} & ${disagreePair[1]} (${Math.round(minAgreement * 100)}%)`
    });

    // 10. Round MVP — who gained the most points in each completed round
    let roundMvpDetail = "";
    for (let rki = 0; rki < roundKeys.length; rki++) {
        const rk = roundKeys[rki];
        const pts = scoringValues[rki] || 0;
        let bestPlayer = "";
        let bestPts = 0;
        for (const p of participants) {
            let roundPts = 0;
            for (let ri = 0; ri < 4; ri++) {
                const masterWinners = (master.regions[ri].round_winners[rk] || []).map(w => w.toLowerCase().trim());
                const picks = p.regions[ri].round_winners[rk] || [];
                for (const pick of picks) {
                    if (masterWinners.includes(pick.toLowerCase().trim())) roundPts += pts;
                }
            }
            if (roundPts > bestPts) { bestPts = roundPts; bestPlayer = p.name; }
        }
        if (bestPts > 0) roundMvpDetail += `${roundLabels[rki]}: ${bestPlayer} (+${bestPts}) | `;
    }
    stats.push({
        icon: "\u{1F3C6}",
        title: "Round MVP",
        value: roundMvpDetail ? roundMvpDetail.split("|")[0].trim().split(":")[1].trim() : "N/A",
        detail: roundMvpDetail ? roundMvpDetail.replace(/\| $/, "").trim() : "No rounds completed yet"
    });

    // 11. Contrarian Correct — picks where ONLY one person got it right
    const contrarianCorrects = {};
    for (const p of participants) contrarianCorrects[p.name] = [];
    for (let ri = 0; ri < 4; ri++) {
        const masterRegion = master.regions[ri];
        for (const rk of roundKeys) {
            const masterWinners = masterRegion.round_winners[rk] || [];
            for (const winner of masterWinners) {
                const wLower = winner.toLowerCase().trim();
                const whoPickedIt = [];
                for (const p of participants) {
                    const picks = p.regions[ri].round_winners[rk] || [];
                    if (picks.some(pk => pk.toLowerCase().trim() === wLower)) {
                        whoPickedIt.push(p.name);
                    }
                }
                if (whoPickedIt.length === 1) {
                    contrarianCorrects[whoPickedIt[0]].push(winner);
                }
            }
        }
    }
    const contrarianCorrectKing = Object.entries(contrarianCorrects).sort((a, b) => b[1].length - a[1].length)[0];
    stats.push({
        icon: "\u{1F9D0}",
        title: "Lone Wolf Correct",
        value: contrarianCorrectKing && contrarianCorrectKing[1].length > 0 ? contrarianCorrectKing[0] : "Nobody yet",
        detail: contrarianCorrectKing && contrarianCorrectKing[1].length > 0 ? `Only one to pick: ${contrarianCorrectKing[1].join(", ")}` : "No solo correct picks yet"
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

// ===== Feature 1: Trash Talk Ticker =====
function renderTrashTalkTicker() {
    const participants = bracketData.participants;
    const master = bracketData.master;
    const sorted = [...participants].sort((a, b) => b.score - a.score);
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];
    const roundLabels = ["R32", "S16", "E8", "F4", "Finals", "Champ"];
    const messages = [];

    // Leader running away
    if (sorted.length >= 2) {
        const gap = sorted[0].score - sorted[1].score;
        if (gap >= 3) {
            messages.push(`${sorted[0].name} is running away with it \u2014 everyone else pack it up \ud83c\udfc3`);
        }
    }

    // Tied leaders
    if (sorted.length >= 2 && sorted[0].score === sorted[1].score) {
        const tiedNames = sorted.filter(p => p.score === sorted[0].score).map(p => p.name);
        if (tiedNames.length === 2) {
            messages.push(`${tiedNames[0]} and ${tiedNames[1]} are tied \u2014 this is going to be close! \ud83d\udd25`);
        } else {
            messages.push(`${tiedNames.length}-way tie at the top! It's anyone's game \ud83d\udd25`);
        }
    }

    // Champion pick that lost early
    for (const p of participants) {
        let champPick = "";
        for (const region of p.regions) {
            const c = region.round_winners["Champion"] || [];
            if (c.length > 0) champPick = c[0];
        }
        if (champPick) {
            let eliminated = false;
            for (const mRegion of master.regions) {
                if (isTeamEliminated(champPick.toLowerCase().trim(), mRegion)) {
                    const inRegion = mRegion.matchups.some(m => m.some(t => t.name.toLowerCase().trim() === champPick.toLowerCase().trim()));
                    if (inRegion) { eliminated = true; break; }
                }
            }
            if (eliminated) {
                messages.push(`${p.name} picked ${champPick} to win it all... they got eliminated \ud83d\ude2c`);
            }
        }
    }

    // Worst round picks
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
                    if (!masterWinners.includes(pick.toLowerCase().trim())) wrongCount++;
                }
            }
            if (totalPicks > 0 && wrongCount >= 5) {
                messages.push(`${p.name} has ${wrongCount} wrong picks in ${roundLabels[rki]}... yikes \ud83d\ude02`);
                break;
            }
        }
    }

    // Only N people picked upset winner
    for (const mRegion of master.regions) {
        const r32Winners = mRegion.round_winners["Round of 32"] || [];
        for (const winner of r32Winners) {
            const seed = findTeamSeed(winner, mRegion);
            if (seed && parseInt(seed) >= 10) {
                const whoPickedIt = [];
                for (const p of participants) {
                    const pRegion = p.regions.find(r => r.name === mRegion.name);
                    if (!pRegion) continue;
                    const picks = pRegion.round_winners["Round of 32"] || [];
                    if (picks.some(pk => pk.toLowerCase().trim() === winner.toLowerCase().trim())) {
                        whoPickedIt.push(p.name);
                    }
                }
                if (whoPickedIt.length <= 2 && whoPickedIt.length > 0) {
                    messages.push(`Only ${whoPickedIt.length} ${whoPickedIt.length === 1 ? 'person' : 'people'} picked ${winner} \u2014 ${whoPickedIt.join(" & ")} ${whoPickedIt.length === 1 ? 'was' : 'were'} ${whoPickedIt.length === 1 ? 'one of them' : 'the ones'} \ud83e\udde0`);
                }
            }
        }
    }

    // Chalk picker
    const chalkScores = {};
    for (const p of participants) {
        chalkScores[p.id] = { name: p.name, chalk: 0 };
        for (const rk of roundKeys) {
            for (const region of p.regions) {
                const picks = region.round_winners[rk] || [];
                for (const pick of picks) {
                    const seed = findTeamSeed(pick, region);
                    if (seed && parseInt(seed) >= 1 && parseInt(seed) <= 2) chalkScores[p.id].chalk++;
                }
            }
        }
    }
    const chalkKing = Object.values(chalkScores).sort((a, b) => b.chalk - a.chalk)[0];
    if (chalkKing && chalkKing.chalk > 0) {
        messages.push(`${chalkKing.name} picked the most chalk \u2014 playing it safe! \ud83d\udccf`);
    }

    // Contrarian
    const contrarianScores = {};
    for (const p of participants) {
        contrarianScores[p.id] = { name: p.name, uniquePicks: 0 };
        for (const rk of roundKeys) {
            for (const region of p.regions) {
                const picks = region.round_winners[rk] || [];
                for (const pick of picks) {
                    const pickLower = pick.toLowerCase().trim();
                    let othersPicked = false;
                    for (const op of participants) {
                        if (op.id === p.id) continue;
                        for (const or2 of op.regions) {
                            if ((or2.round_winners[rk] || []).some(op2 => op2.toLowerCase().trim() === pickLower)) {
                                othersPicked = true; break;
                            }
                        }
                        if (othersPicked) break;
                    }
                    if (!othersPicked) contrarianScores[p.id].uniquePicks++;
                }
            }
        }
    }
    const contrarian = Object.values(contrarianScores).sort((a, b) => b.uniquePicks - a.uniquePicks)[0];
    if (contrarian && contrarian.uniquePicks > 0) {
        messages.push(`${contrarian.name} is the biggest contrarian with ${contrarian.uniquePicks} unique picks \ud83d\ude0e`);
    }

    // Last place roast
    if (sorted.length >= 2) {
        const last = sorted[sorted.length - 1];
        messages.push(`${last.name} is bringing up the rear with ${last.score} points \u2014 there's always next year \ud83e\udea6`);
    }

    if (messages.length === 0) {
        messages.push("The tournament is just getting started \u2014 let the chaos begin! \ud83c\udf1a");
    }

    // Duplicate messages for seamless loop
    const tickerEl = document.getElementById("ticker-content");
    const allMessages = [...messages, ...messages];
    tickerEl.innerHTML = allMessages.map(m => `<span>${m}</span>`).join("");

    // Show ticker, then measure actual width to calculate proper speed
    document.getElementById("trash-talk-ticker").classList.remove("hidden");

    // Wait a frame so the browser lays out the content, then set speed
    requestAnimationFrame(() => {
        const contentWidth = tickerEl.scrollWidth;
        const viewportWidth = tickerEl.parentElement.offsetWidth;
        // pixels per second - higher = faster
        const pixelsPerSecond = 500;
        const totalDistance = contentWidth + viewportWidth;
        const duration = totalDistance / pixelsPerSecond;
        tickerEl.style.animationDuration = duration + "s";
    });
}

// ===== Feature 2: Bracket Busted Meter =====
function renderBracketBustedMeter() {
    const container = document.getElementById("bracket-busted-meter");
    const participants = bracketData.participants;
    const master = bracketData.master;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];

    // For each participant, count alive vs eliminated remaining picks
    const bustedData = participants.map(p => {
        let alive = 0;
        let eliminated = 0;
        let total = 0;

        for (let ri = 0; ri < 4; ri++) {
            const pickRegion = p.regions[ri];
            const masterRegion = master.regions[ri];

            for (const rk of roundKeys) {
                const picks = pickRegion.round_winners[rk] || [];
                const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());

                for (const pick of picks) {
                    const pickLower = pick.toLowerCase().trim();
                    // Skip already scored correct picks
                    if (masterWinners.includes(pickLower)) continue;
                    total++;
                    if (isTeamEliminated(pickLower, masterRegion)) {
                        eliminated++;
                    } else {
                        alive++;
                    }
                }
            }
        }

        const bustedPct = total > 0 ? Math.round((eliminated / total) * 100) : 0;
        let icon = "\ud83d\udcaa"; // flexed biceps
        if (bustedPct > 70) icon = "\ud83d\udc80"; // skull
        else if (bustedPct > 50) icon = "\ud83d\ude30"; // anxious face

        return { name: p.name, alive, eliminated, total, bustedPct, icon };
    });

    // Sort by most busted
    bustedData.sort((a, b) => b.bustedPct - a.bustedPct);

    let html = `<div class="busted-header">\ud83c\udfe5 BRACKET HEALTH CHECK</div>`;
    html += `<div class="busted-grid">`;

    for (const d of bustedData) {
        const alivePct = d.total > 0 ? Math.round((d.alive / d.total) * 100) : 100;
        const barClass = alivePct < 30 ? "danger" : "";
        html += `
            <div class="busted-card">
                <div class="busted-card-top">
                    <span class="busted-name">${d.name}</span>
                    <span class="busted-icon">${d.icon}</span>
                </div>
                <div class="busted-bar-track">
                    <div class="busted-bar-fill ${barClass}" style="width: ${Math.max(alivePct, 5)}%">${alivePct}%</div>
                </div>
                <div class="busted-detail">${d.alive} alive / ${d.eliminated} eliminated out of ${d.total} remaining picks</div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ===== Feature 3: Region-by-Region Mini Leaderboard =====
function renderRegionMiniLeaderboards() {
    const container = document.getElementById("region-mini-leaderboards");
    const participants = bracketData.participants;
    const master = bracketData.master;
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];
    const scoringValues = Object.values(bracketData.scoring);
    const regionNames = master.regions.map(r => r.name);

    let html = `<div class="region-mini-header">\ud83c\udfc0 REGION-BY-REGION LEADERBOARD</div>`;
    html += `<div class="region-mini-grid">`;

    for (let ri = 0; ri < 4; ri++) {
        const regionName = regionNames[ri];
        const masterRegion = master.regions[ri];

        // Calculate each participant's score in this region
        const regionScores = participants.map(p => {
            let score = 0;
            const pickRegion = p.regions[ri];
            for (let rki = 0; rki < roundKeys.length; rki++) {
                const rk = roundKeys[rki];
                const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
                const picks = pickRegion.round_winners[rk] || [];
                for (const pick of picks) {
                    if (masterWinners.includes(pick.toLowerCase().trim())) {
                        score += scoringValues[rki] || 0;
                    }
                }
            }
            return { name: p.name, score };
        });

        regionScores.sort((a, b) => b.score - a.score);

        html += `<div class="region-mini-card">`;
        html += `<div class="region-mini-title">${regionName}</div>`;
        html += `<ul class="region-mini-list">`;

        regionScores.forEach((rs, idx) => {
            const isLeader = idx === 0 && rs.score > 0;
            html += `<li class="${isLeader ? 'leader' : ''}">
                <span><span class="region-mini-rank">${idx + 1}.</span> ${rs.name}</span>
                <span class="region-mini-score">${rs.score} pts</span>
            </li>`;
        });

        html += `</ul></div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ===== Feature 4: Screenshot/Share Button =====
function initShareButton() {
    const btn = document.getElementById("share-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
        const sorted = [...bracketData.participants].sort((a, b) => b.score - a.score);
        let rank = 1;
        sorted.forEach((p, i) => {
            if (i > 0 && p.score < sorted[i - 1].score) rank = i + 1;
            p.rank = rank;
        });

        const medals = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"];
        const now = new Date();
        const timestamp = now.toLocaleDateString() + " " + now.toLocaleTimeString();

        let text = "\ud83c\udfc0 WEBSTER FAMILY BRACKET CHALLENGE 2026 \ud83c\udfc0\n";
        text += "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n";

        for (const p of sorted) {
            const medal = p.rank <= 3 ? medals[p.rank - 1] + " " : "   ";
            const maxP = calculateMaxPossible(p);
            text += `${medal}#${p.rank} ${p.name}: ${p.score} pts (max ${maxP})\n`;
        }

        text += "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n";
        text += `Updated: ${timestamp}\n`;

        navigator.clipboard.writeText(text).then(() => {
            btn.innerHTML = "\ud83d\udccb Copied!";
            btn.classList.add("copied");
            setTimeout(() => {
                btn.innerHTML = "\ud83d\udcf8 Share";
                btn.classList.remove("copied");
            }, 2000);
        }).catch(() => {
            // Fallback
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            btn.innerHTML = "\ud83d\udccb Copied!";
            btn.classList.add("copied");
            setTimeout(() => {
                btn.innerHTML = "\ud83d\udcf8 Share";
                btn.classList.remove("copied");
            }, 2000);
        });
    });
}

// ===== Feature 5: Auto-Generated Daily Recap =====
function renderDailyRecap() {
    const container = document.getElementById("daily-recap");
    const body = document.getElementById("daily-recap-body");

    // Check if dismissed
    if (sessionStorage.getItem("recap-dismissed") === "true") {
        container.classList.add("hidden");
        return;
    }

    const participants = bracketData.participants;
    const master = bracketData.master;
    const sorted = [...participants].sort((a, b) => b.score - a.score);
    const roundKeys = ["Round of 32", "Sweet 16", "Elite 8", "Final Four", "Finalist", "Champion"];

    const lines = [];

    // Who's leading and by how much
    if (sorted.length >= 2) {
        const leader = sorted[0];
        const second = sorted[1];
        const gap = leader.score - second.score;
        if (gap === 0) {
            const tiedNames = sorted.filter(p => p.score === leader.score).map(p => p.name);
            lines.push(`We've got a ${tiedNames.length}-way tie at the top! ${tiedNames.join(", ")} are all knotted up at ${leader.score} points.`);
        } else if (gap <= 2) {
            lines.push(`${leader.name} leads with ${leader.score} points, but ${second.name} is right on ${pronoun(leader.name, 'possessive')} heels with ${second.score}. Just ${gap} point${gap > 1 ? 's' : ''} separating them!`);
        } else {
            lines.push(`${leader.name} is sitting pretty at the top with ${leader.score} points, ${gap} ahead of ${second.name} (${second.score}). ${pronoun(leader.name, 'subject').charAt(0).toUpperCase() + pronoun(leader.name, 'subject').slice(1)}'s got a comfortable lead so far.`);
        }
    }

    // Last place
    const last = sorted[sorted.length - 1];
    if (last && sorted.length > 2) {
        lines.push(`${last.name} is holding down the fort at the bottom with ${last.score} points. Never too late for ${pronoun(last.name, 'object')} to make a comeback!`);
    }

    // Count completed games
    let completedGames = 0;
    let totalUpsets = 0;
    for (const region of master.regions) {
        const r32Winners = region.round_winners["Round of 32"] || [];
        completedGames += r32Winners.length;
        for (const winner of r32Winners) {
            const seed = findTeamSeed(winner, region);
            if (seed && parseInt(seed) >= 9) totalUpsets++;
        }
    }

    if (completedGames > 0) {
        let gameMsg = `${completedGames} game${completedGames > 1 ? 's' : ''} in the books so far`;
        if (totalUpsets > 0) {
            gameMsg += ` with ${totalUpsets} upset${totalUpsets > 1 ? 's' : ''}! March Madness living up to its name.`;
        } else {
            gameMsg += `. The favorites are holding strong.`;
        }
        lines.push(gameMsg);
    }

    // Most busted bracket
    const bustedData = participants.map(p => {
        let eliminated = 0, total = 0;
        for (let ri = 0; ri < 4; ri++) {
            const pickRegion = p.regions[ri];
            const masterRegion = master.regions[ri];
            for (const rk of roundKeys) {
                const picks = pickRegion.round_winners[rk] || [];
                const masterWinners = (masterRegion.round_winners[rk] || []).map(w => w.toLowerCase().trim());
                for (const pick of picks) {
                    if (masterWinners.includes(pick.toLowerCase().trim())) continue;
                    total++;
                    if (isTeamEliminated(pick.toLowerCase().trim(), masterRegion)) eliminated++;
                }
            }
        }
        return { name: p.name, pct: total > 0 ? Math.round((eliminated / total) * 100) : 0 };
    });
    bustedData.sort((a, b) => b.pct - a.pct);
    if (bustedData[0] && bustedData[0].pct > 30) {
        lines.push(`${bustedData[0].name}'s bracket is looking rough with ${bustedData[0].pct}% of ${pronoun(bustedData[0].name, 'possessive')} remaining picks eliminated. Hang in there!`);
    }

    if (lines.length === 0) {
        lines.push("The tournament hasn't started yet. Check back once the games begin for your daily recap!");
    }

    body.innerHTML = lines.map(l => `<p>${l}</p>`).join("");
    container.classList.remove("hidden");

    // Dismiss handler
    document.getElementById("daily-recap-close").addEventListener("click", () => {
        container.classList.add("hidden");
        sessionStorage.setItem("recap-dismissed", "true");
    });
}
