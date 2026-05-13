/**
 * Generates round-robin fixtures for a set of teams divided into pools.
 * @param {Array} teams - Array of team objects
 * @returns {Object} { pools, fixtures }
 */
const generateFixtures = (teams) => {
    // Shuffle teams
    const shuffled = [...teams].sort(() => 0.5 - Math.random());
    const pools = { 'A': [], 'B': [], 'C': [], 'D': [] };
    
    // Distribute into 4 pools
    shuffled.forEach((team, index) => {
        const poolKey = String.fromCharCode(65 + (index % 4)); 
        pools[poolKey].push(team);
    });

    const fixtures = [];
    Object.entries(pools).forEach(([pool, poolTeams]) => {
        // Round Robin within each pool
        for (let i = 0; i < poolTeams.length; i++) {
            for (let j = i + 1; j < poolTeams.length; j++) {
                fixtures.push({
                    id: `match_${pool}_${i}_${j}_${Date.now()}`,
                    teamAId: poolTeams[i].id,
                    teamBId: poolTeams[j].id,
                    teamAName: poolTeams[i].name,
                    teamBName: poolTeams[j].name,
                    pool,
                    status: 'scheduled',
                    scoreA: 0,
                    scoreB: 0,
                    half: 1,
                    timer: 1200, // 20 mins
                    events: []
                });
            }
        }
    });

    return { pools, fixtures };
};

module.exports = { generateFixtures };
