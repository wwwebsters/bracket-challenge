// Unit tests for elimination logic: isTeamEliminated, calculateMaxPossible, canWin
// Run with: node test_elimination.js

let passed = 0, failed = 0;

function assert(condition, msg) {
    if (condition) { passed++; console.log("  ✓ " + msg); }
    else { failed++; console.error("  ✗ FAIL: " + msg); }
}

// ---- Minimal test fixture matching real bracket structure ----
// 4 regions, 8 matchups each, with round_winners through F4
function makeTestData() {
    function makeRegion(name, matchups, roundWinners) {
        return {
            name,
            matchups: matchups.map(([a, b]) => [
                { name: a, seed: 1, row: 1 },
                { name: b, seed: 16, row: 2 }
            ]),
            round_winners: roundWinners
        };
    }

    // Simplified 4 regions with 8 matchups each
    // East: Duke(1) beats Siena, Ohio St beats TCU, StJohns beats NIU, Kansas beats CalBap,
    //        Louisville beats USF, MichSt beats NDSU, UCLA beats UCF, UConn beats Furman
    //   R32: Duke, OhioSt, StJohns, Kansas, Louisville, MichSt, UCLA, UConn
    //   S16: Duke, StJohns, MichSt, UConn
    //   E8:  Duke, UConn
    //   F4:  UConn  (Duke eliminated in E8)
    const east = makeRegion("East", [
        ["Duke", "Siena"], ["Ohio State", "TCU"],
        ["St. John's", "Northern Iowa"], ["Kansas", "Cal Baptist"],
        ["Louisville", "South Florida"], ["Michigan State", "N. Dakota State"],
        ["UCLA", "UCF"], ["UConn", "Furman"]
    ], {
        "Round of 32": ["Duke", "Ohio State", "St. John's", "Kansas", "Louisville", "Michigan State", "UCLA", "UConn"],
        "Sweet 16": ["Duke", "St. John's", "Michigan State", "UConn"],
        "Elite 8": ["Duke", "UConn"],
        "Final Four": ["UConn"],
        "Finalist": [],
        "Champion": []
    });

    // West: Arizona beats LIU, Villanova beats UtahSt, Wisconsin beats HighPt, Arkansas beats Hawaii,
    //       BYU beats TXNC, Gonzaga beats Kennesaw, Miami beats Missouri, Purdue beats Queens
    //   E8: Arizona, Purdue
    //   F4: Arizona
    const west = makeRegion("West", [
        ["Arizona", "LIU"], ["Villanova", "Utah State"],
        ["Wisconsin", "High Point"], ["Arkansas", "Hawaii"],
        ["BYU", "TX/NC State"], ["Gonzaga", "Kennesaw State"],
        ["Miami (FL)", "Missouri"], ["Purdue", "Queens"]
    ], {
        "Round of 32": ["Arizona", "Villanova", "Wisconsin", "Arkansas", "TX/NC State", "Gonzaga", "Miami (FL)", "Purdue"],
        "Sweet 16": ["Arizona", "Arkansas", "TX/NC State", "Purdue"],
        "Elite 8": ["Arizona", "Purdue"],
        "Final Four": ["Arizona"],
        "Finalist": []
    });

    // South: Florida beats PV, Clemson beats Iowa, Vanderbilt beats McNeese, Nebraska beats Troy,
    //        NCarolina beats VCU, Illinois beats Penn, StMarys beats TexAM, Houston beats Idaho
    //   E8: Illinois, Iowa
    //   F4: Illinois
    const south = makeRegion("South", [
        ["Florida", "PV A&M/Lehigh"], ["Clemson", "Iowa"],
        ["Vanderbilt", "McNeese"], ["Nebraska", "Troy"],
        ["North Carolina", "VCU"], ["Illinois", "Penn"],
        ["Saint Mary's", "Texas A&M"], ["Houston", "Idaho"]
    ], {
        "Round of 32": ["Florida", "Iowa", "Vanderbilt", "Nebraska", "VCU", "Illinois", "Texas A&M", "Houston"],
        "Sweet 16": ["Florida", "Vanderbilt", "Illinois", "Houston"],
        "Elite 8": ["Illinois", "Iowa"],
        "Final Four": ["Illinois"],
        "Finalist": [],
        "Champion": []
    });

    // Midwest: Michigan beats UMBC, Georgia beats StLouis, TexasTech beats Akron, Alabama beats Hofstra,
    //          Tennessee beats SMU, Virginia beats WrightSt, Kentucky beats SantaClara, IowaState beats TennSt
    //   E8: Michigan, Tennessee
    //   F4: Michigan
    const midwest = makeRegion("Midwest", [
        ["Michigan", "UMBC/Howard"], ["Georgia", "Saint Louis"],
        ["Texas Tech", "Akron"], ["Alabama", "Hofstra"],
        ["Tennessee", "SMU/Miami OH"], ["Virginia", "Wright State"],
        ["Kentucky", "Santa Clara"], ["Iowa State", "Tennessee State"]
    ], {
        "Round of 32": ["Michigan", "Saint Louis", "Texas Tech", "Alabama", "Tennessee", "Virginia", "Kentucky", "Iowa State"],
        "Sweet 16": ["Michigan", "Texas Tech", "Tennessee", "Iowa State"],
        "Elite 8": ["Michigan", "Tennessee"],
        "Final Four": ["Michigan"],
        "Finalist": []
    });

    return {
        scoring: { "Second": 1, "Sweet 16": 2, "Elite 8": 3, "Final 4": 4, "Finalists": 5, "Champions": 6 },
        master: { regions: [east, west, south, midwest] },
        participants: []
    };
}

function makeParticipant(name, score, regionPicks) {
    // regionPicks: array of 4 objects with round_winners for each region
    // Each inherits matchups from master but has its own round_winners
    const data = makeTestData();
    const regions = data.master.regions.map((mr, i) => ({
        name: mr.name,
        matchups: mr.matchups,
        round_winners: regionPicks[i] || {}
    }));
    return { name, score, regions };
}

// ---- Load functions under test by simulating the global bracketData ----
// We extract the pure logic functions from app.js by evaluating them with a mock global

const fs = require("fs");
const appCode = fs.readFileSync("app.js", "utf8");

// Extract function bodies
function extractFunction(code, name) {
    const regex = new RegExp(`function ${name}\\b[^]*?\\n\\}`, "m");
    const match = code.match(regex);
    if (!match) throw new Error("Could not find function: " + name);
    return match[0];
}

// Build a test module with the functions we need
const testModule = `
let bracketData = null;
function setBracketData(d) { bracketData = d; }
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
${extractFunction(appCode, "isTeamEliminated")}
${extractFunction(appCode, "calculateMaxPossible")}
${extractFunction(appCode, "getFinalistAndChampionPicks")}
${extractFunction(appCode, "scoreForScenario")}
${extractFunction(appCode, "canWin")}
module.exports = { setBracketData, isTeamEliminated, calculateMaxPossible, getFinalistAndChampionPicks, scoreForScenario, canWin };
`;

// Write temp module and load it
const tmpPath = require("path").join(__dirname, "_test_funcs.js");
fs.writeFileSync(tmpPath, testModule);
const funcs = require(tmpPath);
fs.unlinkSync(tmpPath); // clean up

// ---- Tests ----

console.log("\n=== isTeamEliminated ===");
{
    const data = makeTestData();
    funcs.setBracketData(data);
    const east = data.master.regions[0];
    const west = data.master.regions[1];
    const south = data.master.regions[2];
    const midwest = data.master.regions[3];

    // Teams that lost in R64
    assert(funcs.isTeamEliminated("siena", east) === true, "Siena eliminated in R64 (lost to Duke)");
    assert(funcs.isTeamEliminated("tcu", east) === true, "TCU eliminated in R64");

    // Teams that won R64 but lost in R32
    assert(funcs.isTeamEliminated("ohio state", east) === true, "Ohio State eliminated in R32");
    assert(funcs.isTeamEliminated("kansas", east) === true, "Kansas eliminated in R32");

    // Teams that won R32 but lost in S16
    assert(funcs.isTeamEliminated("st. john's", east) === true, "St. John's eliminated in S16");

    // Teams that won S16 but lost in E8
    assert(funcs.isTeamEliminated("duke", east) === true, "Duke eliminated in E8 (UConn won F4)");

    // F4 teams still alive
    assert(funcs.isTeamEliminated("uconn", east) === false, "UConn alive (East F4 winner)");
    assert(funcs.isTeamEliminated("arizona", west) === false, "Arizona alive (West F4 winner)");
    assert(funcs.isTeamEliminated("illinois", south) === false, "Illinois alive (South F4 winner)");
    assert(funcs.isTeamEliminated("michigan", midwest) === false, "Michigan alive (Midwest F4 winner)");

    // Cross-region lookup: Arizona checked against East region should still be alive
    assert(funcs.isTeamEliminated("arizona", east) === false, "Arizona alive when checked against East (cross-region)");
    assert(funcs.isTeamEliminated("michigan", east) === false, "Michigan alive when checked against East (cross-region)");

    // Cross-region: eliminated team checked against wrong region
    assert(funcs.isTeamEliminated("duke", west) === true, "Duke eliminated even when checked against West (cross-region)");

    // Team not in any region
    assert(funcs.isTeamEliminated("fake team", east) === true, "Nonexistent team is eliminated");
}

console.log("\n=== calculateMaxPossible ===");
{
    const data = makeTestData();
    funcs.setBracketData(data);

    // Participant with all picks already scored or eliminated — max = current score
    const allDead = makeParticipant("AllDead", 50, [
        { "Round of 32": ["Duke"], "Sweet 16": ["Duke"], "Elite 8": ["Duke"], "Final Four": ["Duke"], "Finalist": ["Duke"], "Champion": ["Duke"] },
        { "Round of 32": ["Arizona"], "Final Four": ["Purdue"], "Finalist": ["Purdue"] },
        { "Final Four": ["Florida"] },
        { "Final Four": ["Michigan"] }
    ]);
    data.participants = [allDead];
    // Duke: scored through E8, eliminated at F4. Duke F4 pick = unscored + eliminated. Duke Finalist/Champion = unscored + eliminated.
    // Purdue: eliminated (Arizona won West E8). Purdue F4, Finalist = unscored + eliminated.
    // Florida: eliminated (not in South E8 winners path). Unscored + eliminated.
    // Michigan: F4 pick = already scored (Michigan IS F4 winner). Max adds 0 for already scored.
    assert(funcs.calculateMaxPossible(allDead) === 50, "All eliminated/scored picks: max = current score");

    // Participant with alive cross-region champion pick
    const crossRegion = makeParticipant("CrossRegion", 70, [
        { "Finalist": ["UConn"], "Champion": ["Arizona"] }, // Arizona is in West, stored in East
        { "Finalist": ["Arizona"] },
        {},
        {}
    ]);
    data.participants = [crossRegion];
    // UConn Finalist (East): alive, unscored → +5
    // Arizona Champion (East, cross-region): alive, unscored → +6
    // Arizona Finalist (West): alive, unscored → +5
    assert(funcs.calculateMaxPossible(crossRegion) === 86, "Cross-region Arizona champion pick counted: 70+5+6+5=86");
}

console.log("\n=== canWin ===");
{
    const data = makeTestData();
    funcs.setBracketData(data);

    // Scenario from real data: Dad=80, Jared=74 with Arizona picks, Molly=70 with Arizona picks
    const dad = makeParticipant("Dad", 80, [
        { "Finalist": ["UConn"], "Champion": ["Michigan"] },  // UConn from East, Michigan cross-region
        { "Finalist": ["Michigan"] },  // Michigan cross-region from West
        {},
        {}
    ]);
    const jared = makeParticipant("Jared", 74, [
        { "Finalist": ["UConn"], "Champion": ["Arizona"] },  // Arizona cross-region
        { "Finalist": ["Arizona"] },
        {},
        {}
    ]);
    const molly = makeParticipant("Molly", 70, [
        { "Finalist": ["UConn"], "Champion": ["Arizona"] },  // same as Jared
        { "Finalist": ["Arizona"] },
        {},
        {}
    ]);
    const gavin = makeParticipant("Gavin", 60, [
        { "Finalist": ["Duke"], "Champion": ["Duke"] },  // all eliminated
        { "Finalist": ["Purdue"] },
        {},
        {}
    ]);

    data.participants = [dad, jared, molly, gavin];

    assert(funcs.canWin(dad, data.participants) === true, "Dad can win (leads in most scenarios)");
    assert(funcs.canWin(jared, data.participants) === true, "Jared can win (Arizona wins semi + championship vs Illinois)");
    assert(funcs.canWin(molly, data.participants) === false, "Molly cannot win (Jared always ahead in her best scenarios)");
    assert(funcs.canWin(gavin, data.participants) === false, "Gavin cannot win (all remaining picks eliminated)");

    // Edge case: two players tied — both should be able to "win"
    const tied1 = makeParticipant("Tied1", 80, [{}, {}, {}, {}]);
    const tied2 = makeParticipant("Tied2", 80, [{}, {}, {}, {}]);
    data.participants = [tied1, tied2];
    assert(funcs.canWin(tied1, data.participants) === true, "Tied player 1 can win");
    assert(funcs.canWin(tied2, data.participants) === true, "Tied player 2 can win");

    // Edge case: trailing player with unique winning pick
    const leader = makeParticipant("Leader", 80, [
        { "Champion": ["Michigan"] },
        {},
        {},
        {}
    ]);
    const underdog = makeParticipant("Underdog", 76, [
        { "Finalist": ["UConn"], "Champion": ["UConn"] },
        {},
        {},
        {}
    ]);
    data.participants = [leader, underdog];
    // If UConn makes final (+5) and wins (+6) = 76+11=87. Leader gets 0 or +6 (Michigan champ) max = 86.
    // Scenario: UConn vs Illinois final, UConn wins → Underdog=87, Leader=80. Underdog wins!
    assert(funcs.canWin(underdog, data.participants) === true, "Underdog can win with unique UConn finalist+champion picks");

    // Edge case: player behind but opponent always scores more
    const dominant = makeParticipant("Dominant", 80, [
        { "Finalist": ["Arizona"], "Champion": ["Arizona"] },
        { "Finalist": ["Arizona"] },
        {},
        {}
    ]);
    const hopeless = makeParticipant("Hopeless", 70, [
        { "Finalist": ["Arizona"], "Champion": ["Arizona"] },
        { "Finalist": ["Arizona"] },
        {},
        {}
    ]);
    data.participants = [dominant, hopeless];
    // Same picks but 10 pts behind — can never catch up
    assert(funcs.canWin(hopeless, data.participants) === false, "Hopeless cannot win (same picks but 10pts behind)");
}

console.log("\n=== scoreForScenario ===");
{
    const data = makeTestData();
    funcs.setBracketData(data);

    const player = makeParticipant("Test", 50, [
        { "Finalist": ["Arizona"], "Champion": ["Arizona"] },
        { "Finalist": ["Michigan"] },
        {},
        {}
    ]);
    data.participants = [player];

    // Arizona and Michigan both make final, Arizona wins
    const scenario1 = { finalists: ["arizona", "michigan"], champion: "arizona" };
    assert(funcs.scoreForScenario(player, scenario1) === 66, "Arizona Fin(+5) + Michigan Fin(+5) + Arizona Champ(+6) = 50+16=66");

    // Arizona and Illinois make final, Illinois wins
    const scenario2 = { finalists: ["arizona", "illinois"], champion: "illinois" };
    assert(funcs.scoreForScenario(player, scenario2) === 55, "Arizona Fin(+5) only = 50+5=55");

    // UConn and Illinois make final — no matching picks
    const scenario3 = { finalists: ["uconn", "illinois"], champion: "uconn" };
    assert(funcs.scoreForScenario(player, scenario3) === 50, "No matching picks = 50+0=50");
}

// ---- Summary ----
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
