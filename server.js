const app = require('express');
const app = express();
require('dotenv').config();

app.get('/', () => {
    res.send('Hello World');
});

app.listen(process.env.HTTP_PORT);
