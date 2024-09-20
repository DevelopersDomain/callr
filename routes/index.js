var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('home');
});
router.get('/meeting', function(req, res, next) {
  res.render('meeting');
});
router.get('/rec', function(req, res, next) {
  res.render('rec');
});

module.exports = router;
