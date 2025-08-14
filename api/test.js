// Simple test endpoint to verify Vercel deployment
module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
        message: 'Vercel API is working!',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url
    });
};