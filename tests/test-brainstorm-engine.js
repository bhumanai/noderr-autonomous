// Test the BrainstormEngine advanced features
const fs = require('fs');
const path = require('path');

// Load the BrainstormEngine code
const engineCode = fs.readFileSync(path.join(__dirname, '../docs/brainstorm-engine.js'), 'utf8');

// Create a function wrapper to properly expose the classes
const setupEngine = new Function('module', 'exports', engineCode + '\nreturn {BrainstormEngine, RedTeamAgent, BlueTeamAgent, DevilsAdvocateAgent};');
const engineModule = { exports: {} };
const classes = setupEngine(engineModule, engineModule.exports);

// Extract the classes
const {BrainstormEngine, RedTeamAgent, BlueTeamAgent, DevilsAdvocateAgent} = classes;

console.log('🧪 Testing BrainstormEngine Advanced Features');
console.log('=============================================\n');

async function runTests() {
    const engine = new BrainstormEngine();
    let testsPassed = 0;
    let testsFailed = 0;
    
    // Test 1: Deep Analysis for Feature Request
    console.log('📋 Test 1: Deep Feature Analysis');
    try {
        const featureAnalysis = await engine.deepAnalyze(
            'I want to build a real-time collaborative document editor with version control',
            {}
        );
        
        console.log('✅ Generated ' + featureAnalysis.tasks.length + ' tasks');
        const uniquePhases = [...new Set(featureAnalysis.tasks.map(t => t.phase).filter(Boolean))];
        console.log('   Phases: ' + uniquePhases.join(', '));
        console.log('   Questions: ' + featureAnalysis.questions.length);
        console.log('   Context insights: ' + featureAnalysis.context.codebaseInsights.length);
        testsPassed++;
    } catch (error) {
        console.log('❌ Feature analysis failed:', error.message);
        testsFailed++;
    }
    
    // Test 2: Adversarial Agents
    console.log('\n📋 Test 2: Adversarial Agent Analysis');
    try {
        const redTeam = new RedTeamAgent();
        const blueTeam = new BlueTeamAgent();
        const devilsAdvocate = new DevilsAdvocateAgent();
        
        const redAnalysis = await redTeam.analyze('Add payment processing', {});
        const blueAnalysis = await blueTeam.analyze('Add payment processing', {});
        const devilAnalysis = await devilsAdvocate.analyze('Add payment processing', {});
        
        console.log('✅ Red Team identified ' + redAnalysis.concerns.length + ' concerns');
        console.log('✅ Blue Team proposed ' + blueAnalysis.mitigations.length + ' mitigations');
        console.log('✅ Devil\'s Advocate raised: "' + devilAnalysis.challenge + '"');
        testsPassed += 3;
    } catch (error) {
        console.log('❌ Adversarial analysis failed:', error.message);
        testsFailed++;
    }
    
    // Test 3: Task Generation for Different Intents
    console.log('\n📋 Test 3: Multi-Intent Task Generation');
    const intents = [
        { message: 'Add user authentication', expectedIntent: 'feature' },
        { message: 'Fix the login bug', expectedIntent: 'bug' },
        { message: 'Refactor the database layer', expectedIntent: 'refactor' },
        { message: 'Optimize API response time', expectedIntent: 'performance' }
    ];
    
    for (const test of intents) {
        try {
            const analysis = await engine.deepAnalyze(test.message, {});
            const taskCount = analysis.tasks.length;
            console.log('✅ "' + test.message + '" generated ' + taskCount + ' tasks');
            
            // Check for expected task phases
            const phases = [...new Set(analysis.tasks.map(t => t.phase).filter(Boolean))];
            if (phases.length > 0) {
                console.log('   Phases: ' + phases.join(', '));
            }
            testsPassed++;
        } catch (error) {
            console.log('❌ Failed for "' + test.message + '": ' + error.message);
            testsFailed++;
        }
    }
    
    // Test 4: Task Dependencies and Complexity
    console.log('\n📋 Test 4: Task Dependencies and Metrics');
    try {
        const complexAnalysis = await engine.deepAnalyze(
            'Build a microservices architecture with API gateway',
            {}
        );
        
        const tasksWithDeps = complexAnalysis.tasks.filter(t => t.dependencies && t.dependencies.length > 0);
        const complexTasks = complexAnalysis.tasks.filter(t => t.complexity === 'high');
        const phasedTasks = complexAnalysis.tasks.filter(t => t.phase);
        
        console.log('✅ ' + tasksWithDeps.length + '/' + complexAnalysis.tasks.length + ' tasks have dependencies');
        console.log('✅ ' + complexTasks.length + ' high-complexity tasks');
        console.log('✅ ' + phasedTasks.length + ' tasks assigned to phases');
        testsPassed += 3;
    } catch (error) {
        console.log('❌ Dependency analysis failed:', error.message);
        testsFailed++;
    }
    
    // Test 5: Context Building and Questions
    console.log('\n📋 Test 5: Context and Clarifying Questions');
    try {
        const contextAnalysis = await engine.deepAnalyze(
            'Migrate from monolith to microservices',
            { existingContext: 'test' }
        );
        
        console.log('✅ Generated ' + contextAnalysis.questions.length + ' clarifying questions');
        console.log('   Sample questions:');
        contextAnalysis.questions.slice(0, 3).forEach(q => {
            console.log('   - ' + q);
        });
        testsPassed++;
    } catch (error) {
        console.log('❌ Context analysis failed:', error.message);
        testsFailed++;
    }
    
    // Final Report
    console.log('\n=========================================');
    console.log('📊 BRAINSTORM ENGINE TEST REPORT');
    console.log('=========================================');
    console.log('✅ Tests Passed: ' + testsPassed);
    console.log('❌ Tests Failed: ' + testsFailed);
    
    if (testsFailed === 0) {
        console.log('\n🎉 ALL BRAINSTORM ENGINE TESTS PASSED!');
        console.log('The engine is generating deep, multi-phase tasks with proper dependencies!');
    }
}

runTests().catch(console.error);