# Database Setup Instructions

This guide will help you set up the MySQL database for the Sethro Medical Center application.

## Prerequisites
- **MySQL Server** installed and running.
- **MySQL Workbench**, **DBeaver**, or **Command Line Interface** to execute queries.
- **`.env.local`** file configured in your project root with your database credentials.

## Step 1: Create the Database
First, log in to your MySQL server and create the database name you specified in your `.env.local` file (e.g., `sethro_medical`).

```sql
CREATE DATABASE sethro_medical;
USE sethro_medical;
```

## Step 2: Run the Schema Script
Locate the file `databas_setup_querries/01_schema.sql` in your project folder. This file contains all the necessary SQL commands to create the tables.

### Option A: Using MySQL Workbench / DBeaver / GUI Tools
1. Open the tool and connect to your database.
2. Select the `sethro_medical` database.
3. Open the `01_schema.sql` file.
4. Execute the entire script (Run all).

### Option B: Using Command Line
Open your terminal and run the following command (replace `your_username` and `your_database_name`):

```bash
mysql -u your_username -p sethro_medical < "databas_setup_querries/01_schema.sql"
```

## Step 3: Verify the Setup
After running the script, verify that the following tables exist in your database:
- `users`
- `patients`
- `doctors`
- `medicines`
- `lab_tests`
- `appointments`
- `prescriptions`
- `prescription_items`
- `lab_requests`
- `bills`

## Step 4: Seed Data (Optional)
The schema file includes a small section at the bottom for inserting initial test users. 
**Note**: The passwords in the seed data are placeholders. You will need to generate real bcrypt hashes for them if you want to log in with these accounts immediately, or register new accounts via the application.
