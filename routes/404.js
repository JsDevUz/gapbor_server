const notfound = (req, res) => {
    res.status(404).send('not found')
}
module.exports = { notfound }