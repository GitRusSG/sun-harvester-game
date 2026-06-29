const express = require('express')

const { sendError } = require('./utils')
const userData = require('./data')

const router = express.Router()

router.get("/login", (req, res) => {
  const inputUsername = req.query.username
  const inputPassword = req.query.password

  // Check if username exists in our data
  if (!(inputUsername in userData)) {
    return sendError(res, "User not found")
  }

  const actualPassword = userData[inputUsername]

  // Check if password matches
  if (actualPassword === inputPassword) {
    return res.render("welcome", { username: inputUsername })
  } else {
    return sendError(res, "Incorrect password")
  }
})

module.exports = router;
