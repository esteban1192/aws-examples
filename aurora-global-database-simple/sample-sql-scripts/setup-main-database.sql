CREATE DATABASE IF NOT EXISTS my_database;

USE my_database;

CREATE TABLE IF NOT EXISTS employees (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  position VARCHAR(100),
  salary DECIMAL(10, 2),
  hire_date DATE
);

INSERT INTO employees (first_name, last_name, position, salary, hire_date) VALUES ('Alice', 'Johnson', 'Software Engineer', 85000.00, '2020-06-15'), ('Bob', 'Smith', 'Product Manager', 95000.00, '2018-03-01'), ('Charlie', 'Brown', 'Data Analyst', 70000.00, '2021-09-10');
