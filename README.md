# 📄 Document Management & Sharing System

A secure web-based document management system built with **Node.js**, **Express**, and **PostgreSQL**, allowing users to upload, share, and manage documents with email notifications.

-----

## ✨ Features

  - 🗂️ Upload and manage documents with metadata (title, description, type)
  - 📤 Share documents via email (with notifications)
  - 🔐 User authentication and password change functionality
  - 🔄 OTP-based verification for sensitive actions
  - 👤 Profile view and update
  - 🗑️ Secure document deletion and access control

-----

## 🧰 Tech Stack

| Tech            | Role                                 |
|-----------------|--------------------------------------|
| Node.js         | Runtime                              |
| Express.js      | Web framework                        |
| PostgreSQL      | Relational database                  |
| EJS             | Template engine                      |
| BcryptJS        | Password hashing                     |
| Nodemailer      | Email service                        |
| Multer          | File uploads                         |

-----

## 📁 Folder Structure

```
├── controllers/
│   ├── documentController.js
│   └── userController.js
├── services/
│   └── emailService.js
├── config/
│   └── db.js
├── views/
│   ├── documents/
│   │   ├── dashboard.ejs
│   │   └── share.ejs
│   └── users/
│       ├── profile.ejs
│       ├── verify-otp.ejs
│       └── initiate-password-change.ejs
├── public/
│   └── uploads/
├── routes/
│   ├── documentRoutes.js
│   └── userRoutes.js
├── app.js
└── README.md
```

-----




### Project Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/S38-dev/govt_docs_project.git govt_doc_project

    cd govt_doc_project

    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Create uploads directory:**

    ```bash
    mkdir -p public/uploads
    ```

-----
## ⚙️ Setup and Installation

### Prerequisites

  - Node.js (v14 or higher)
  - PostgreSQL

### Database Setup

1.  **Create PostgreSQL database:**

    ```bash
    createdb -U postgres govt_docs
    ```

2.  **Execute schema script:**
    You'll need a `schema.sql` file in your root directory. This file should contain the SQL commands to create your database tables (e.g., `users`, `documents`, `shared_documents`).

    ```bash
    psql -U postgres -d govt_docs -f schema.sql
    ```

### Environment Variables (`.env`)

Create a `.env` file in the root directory of your project and add the following environment variables:

```
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=Your_gmail_address
EMAIL_PASSWORD=your_gmail_app_password # Or your actual Gmail password if not using app passwords (less secure)
APP_URL=http://localhost:4000

DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=govt_docs
```


## ▶️ Running the Server

To start the development server:

```bash
node app.js
```

The application will typically run on `http://localhost:4000` (or the port specified in your `APP_URL` environment variable).

-----

## 🧪 Testing

To run the tests for the application, use the following commands:

  - **Run full test suite:**

    ```bash
    npm test
    ```

  - **Generate test coverage report:**

    ```bash
    npm test -- --coverage
    ```

  - **Test specific component:**

    ```bash
    npm test -- <path-to-test-file>
    ```

### Test Features:

✅ Authentication tests
✅ Document upload validation
✅ Sharing permission checks
✅ Audit log verification
✅ Error handling tests
