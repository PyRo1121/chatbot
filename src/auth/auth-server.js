import express from 'express';
import open from 'open';

const app = express();
const port = 8888;

app.get('/callback', (req, res) => {
  const {code} = req.query;
  if (code) {
    res.send(`Authorization code: ${code}`);
  } else {
    res.status(400).send('No code received');
  }
});

app.listen(port, () => {
  console.log(`Auth server running at http://localhost:${port}`);
  open(`http://localhost:${port}`);
});
