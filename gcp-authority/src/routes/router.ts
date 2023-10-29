import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
    res.json({message : 'Hello World!'});
});

//  html を返す
router.get('/index', (req, res) => {
    res.render("gcp", {title: "Google"});
});

export default router;