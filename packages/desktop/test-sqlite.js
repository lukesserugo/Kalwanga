const { app } = require('electron');
const Database = require('better-sqlite3');
app.whenReady().then(() => {
  try {
    const db = new Database(':memory:');
    console.log('OK', db.prepare('SELECT 1 as x').get());
    db.close();
    app.quit();
  } catch (e) {
    console.error('FAILED:', e.message);
    app.quit();
  }
});
