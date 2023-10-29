import express from 'express';
import bodyParser from 'body-parser';
import gcp from './routes/gcp-router';
import index from './routes/router';
import path from 'path';

export const app = express();

app.use(bodyParser.json());

app.use(express.urlencoded({extended: true}));
app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, 'views'));

app.use('/', index);
app.use('/gcp', gcp);