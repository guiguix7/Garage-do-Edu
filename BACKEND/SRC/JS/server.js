import { app, initApp } from './index.js';

const hostname = 'localhost';
const port = process.env.PORT || 3000;

await initApp();

app.listen(port, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
    console.log('Server Start Successfully!');
});
