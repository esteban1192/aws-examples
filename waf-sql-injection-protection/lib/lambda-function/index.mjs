import sqlite3 from 'sqlite3';

const initializeDatabase = () => {
  return new sqlite3.Database(':memory:', (err) => {
    if (err) {
      console.error("Error opening database: ", err.message);
    }
  });
};

const setupDatabase = (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY, name TEXT)");

      db.run(`CREATE TABLE IF NOT EXISTS sensitive_data (
        user_id INT,
        ssn TEXT,
        account_balance REAL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);

      const stmtUsers = db.prepare("INSERT INTO users VALUES (?, ?)");
      const users = [
        [1, 'Alice'], [2, 'Bob'], [3, 'Charlie'], [4, 'David'], [5, 'Eve'],
        [6, 'Frank'], [7, 'Grace'], [8, 'Hannah'], [9, 'Isaac'], [10, 'Jack'],
        [11, 'Karen'], [12, 'Leo'], [13, 'Mona'], [14, 'Nina'], [15, 'Oliver'],
        [16, 'Paul'], [17, 'Quinn'], [18, 'Rachel'], [19, 'Sam'], [20, 'Tina']
      ];

      users.forEach(user => {
        stmtUsers.run(user[0], user[1]);
      });
      stmtUsers.finalize();

      const stmtSensitive = db.prepare("INSERT INTO sensitive_data VALUES (?, ?, ?)");
      const sensitiveData = [
        [1, '123-45-6789', 1500.75], [2, '987-65-4321', 2000.00], [3, '456-78-9012', 3050.25],
        [4, '321-54-9876', 100.50], [5, '159-73-2846', 875.00], [6, '753-91-6428', 5000.00],
        [7, '147-20-3698', 250.00], [8, '369-85-1472', 1320.90], [9, '258-74-3695', 199.99],
        [10, '951-62-7534', 805.25], [11, '123-45-6789', 1200.00], [12, '456-78-9012', 1750.50],
        [13, '789-01-2345', 500.75], [14, '987-65-4321', 3000.80], [15, '321-54-9876', 400.00],
        [16, '159-73-2846', 750.60], [17, '753-91-6428', 3200.00], [18, '147-20-3698', 610.00],
        [19, '369-85-1472', 450.25], [20, '258-74-3695', 1100.75]
      ];

      sensitiveData.forEach(data => {
        stmtSensitive.run(data[0], data[1], data[2]);
      });
      stmtSensitive.finalize((err) => {
        if (err) reject('Error finalizing statements for sensitive data');
        else resolve();
      });
    });
  });
};


const getUser = (db, id) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM users WHERE id = ${id}`, (err, row) => {
      if (err) {
        console.error(err)
        reject({ error: 'SQL Error' });
      } else if (row) {
        resolve({ user: row });
      } else {
        resolve({ error: 'User not found' });
      }
    });
  });
};

export const handler = async (event) => {
  const db = initializeDatabase();
  try {
    await setupDatabase(db);
    const { id } = JSON.parse(event.body);
    const response = await getUser(db, id);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process the request' }),
    };
  } finally {
    db.close();
  }
};
