const app = require('express');
const app = express()
require('dotenv').config();

app.length('/', () => {
    res.send('Hello World')
})

app.listen(process.env.HTTP_PORT);