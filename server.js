const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Neon PostgreSQL Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configure JSON payload limit to support large base64 uploads (e.g. scans up to 10MB)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database Migration & Seeding Function
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Connecting to Neon Database for Production Initialization...');
    await client.query('BEGIN');

    // 0. Create Departments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1. Create Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL, -- 'Học viên', 'Người hướng dẫn', 'Cán bộ quản lý', 'Quản trị viên'
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create Supervisors Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS supervisors (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        dob DATE,
        gender VARCHAR(50),
        email VARCHAR(255),
        phone VARCHAR(50),
        license_number VARCHAR(100) UNIQUE NOT NULL,
        specialty VARCHAR(255) NOT NULL,
        license_date DATE NOT NULL,
        department VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create Practitioners Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS practitioners (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        dob DATE,
        gender VARCHAR(50),
        email VARCHAR(255),
        phone VARCHAR(50),
        degree VARCHAR(255) NOT NULL,
        specialty VARCHAR(255) NOT NULL,
        program VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        supervisor_id INTEGER REFERENCES supervisors(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'Đang thực hành',
        profile_status VARCHAR(50) DEFAULT 'Chờ duyệt',
        rejection_reason TEXT,
        avatar_url TEXT, -- Base64 string for 4x6 photo
        degree_scan_url TEXT, -- Base64 string for graduation scan
        national_test_score FLOAT,
        national_test_result VARCHAR(50) DEFAULT 'Chưa thi',
        national_test_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Create Practice Logs Table (Daily Logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS practice_logs (
        id SERIAL PRIMARY KEY,
        practitioner_id INTEGER REFERENCES practitioners(id) ON DELETE CASCADE,
        log_date DATE NOT NULL,
        department VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        procedures TEXT,
        quantity INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'Chờ xác nhận',
        supervisor_comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Create Evaluations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id SERIAL PRIMARY KEY,
        practitioner_id INTEGER REFERENCES practitioners(id) ON DELETE CASCADE,
        department VARCHAR(255) NOT NULL,
        evaluation_type VARCHAR(50) DEFAULT 'Định kỳ',
        rating_specialty VARCHAR(50),
        rating_ethics VARCHAR(50),
        rating_law VARCHAR(50),
        rating_communication VARCHAR(50),
        rating_safety VARCHAR(50),
        result VARCHAR(50),
        comment TEXT,
        evaluator_id INTEGER REFERENCES supervisors(id) ON DELETE SET NULL,
        evaluation_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Create Supplemental Training Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplemental_training (
        id SERIAL PRIMARY KEY,
        practitioner_id INTEGER REFERENCES practitioners(id) ON DELETE CASCADE,
        session_date DATE NOT NULL,
        topic VARCHAR(255) NOT NULL,
        hours INTEGER DEFAULT 2,
        speaker VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Create Practitioner Rotations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS practitioner_rotations (
        id SERIAL PRIMARY KEY,
        practitioner_id INTEGER REFERENCES practitioners(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        duration VARCHAR(100) NOT NULL,
        start_date DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'Chờ xoay khoa',
        order_index INTEGER DEFAULT 0,
        supervisor_id INTEGER REFERENCES supervisors(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Create Notifications Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Dynamic Safe Column Migrations for existing deployments
    await client.query(`
      ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS department VARCHAR(255);
    `);
    await client.query(`
      ALTER TABLE practitioner_rotations ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES supervisors(id) ON DELETE SET NULL;
    `);

    console.log('Seeding administrative accounts...');

    // Seed Admin (SysAdmin) Account
    await client.query(`
      INSERT INTO users (username, password, role, name, email, phone)
      VALUES ('admin', 'Admin@TTYTLC2026', 'Quản trị viên', 'Phòng CNTT (Quản trị hệ thống)', 'cntt.ttyt@lienchieu.gov.vn', '0988776655')
      ON CONFLICT (username) DO NOTHING;
    `);

    // Seed Manager (Training Department) Account
    await client.query(`
      INSERT INTO users (username, password, role, name, email, phone)
      VALUES ('daotao', 'DaoTao@TTYTLC2026', 'Cán bộ quản lý', 'Trần Thị Thu Hương (Phòng Đào tạo)', 'daotao.ttyt@lienchieu.gov.vn', '0911223344')
      ON CONFLICT (username) DO NOTHING;
    `);

    console.log('Seeding default departments...');
    const defaultDepts = [
      'Khoa Nội tổng hợp',
      'Khoa Ngoại chấn thương',
      'Khoa Sản phụ khoa',
      'Khoa Nhi',
      'Khoa Hồi sức cấp cứu',
      'Khoa Cấp cứu ngoại viện',
      'Khoa Dinh dưỡng lâm sàng',
      'Khoa Tâm lý lâm sàng',
      'Khoa Tai Mũi Họng',
      'Khoa Răng Hàm Mặt',
      'Khoa Mắt',
      'Phòng Đào tạo'
    ];
    for (const dept of defaultDepts) {
      await client.query('INSERT INTO departments (name) VALUES ($1) ON CONFLICT DO NOTHING', [dept]);
    }

    console.log('Production database tables initialized cleanly.');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during production database migration:', err);
  } finally {
    client.release();
  }
}

// Start Database Initialization
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database, server not started:', err);
});

async function seedDefaultRotations(client, practitionerId, program, specialty, startDateStr, supervisorId) {
  let rotations = [];
  if (program === 'ND96') {
    if (specialty === 'Bác sĩ') {
      rotations = [
        { name: 'Thực hành Chuyên môn Lâm sàng', duration: '9 tháng' },
        { name: 'Thực hành Hồi sức Cấp cứu', duration: '3 tháng' }
      ];
    } else if (specialty === 'Y sĩ') {
      rotations = [
        { name: 'Thực hành Chuyên môn Lâm sàng', duration: '6 tháng' },
        { name: 'Thực hành Hồi sức Cấp cứu', duration: '3 tháng' }
      ];
    } else if (['Điều dưỡng', 'Hộ sinh', 'Kỹ thuật y'].includes(specialty)) {
      rotations = [
        { name: 'Thực hành Chuyên môn Chức danh', duration: '5 tháng' },
        { name: 'Thực hành Hồi sức Cấp cứu', duration: '1 tháng' }
      ];
    } else if (specialty === 'Cấp cứu viên ngoại viện') {
      rotations = [
        { name: 'Cấp cứu ngoại viện', duration: '3 tháng' },
        { name: 'Hồi sức cấp cứu', duration: '3 tháng' }
      ];
    } else {
      const mos = specialty === 'Tâm lý lâm sàng' ? '9 tháng' : '6 tháng';
      rotations = [{ name: 'Thực hành Lâm sàng chuyên môn', duration: mos }];
    }
  } else {
    rotations = [
      { name: 'Chuyên khoa Nội (bao gồm Hồi sức cấp cứu)', duration: '5 tháng' },
      { name: 'Chuyên khoa Ngoại', duration: '3 tháng' },
      { name: 'Chuyên khoa Sản phụ khoa', duration: '3 tháng' },
      { name: 'Chuyên khoa Nhi', duration: '4 tháng' },
      { name: 'Các kỹ thuật chuyên khoa khác', duration: '3 tháng' }
    ];
  }

  let currentDate = new Date(startDateStr);
  for (let i = 0; i < rotations.length; i++) {
    const rot = rotations[i];
    const months = parseInt(rot.duration);
    
    const sDate = new Date(currentDate);
    const eDate = new Date(currentDate);
    eDate.setMonth(eDate.getMonth() + months);

    await client.query(
      `INSERT INTO practitioner_rotations (practitioner_id, name, duration, start_date, end_date, status, order_index, supervisor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        practitionerId,
        rot.name,
        rot.duration,
        sDate,
        eDate,
        i === 0 ? 'Đang thực hành' : 'Chờ xoay khoa',
        i,
        supervisorId || null
      ]
    );

    currentDate = eDate;
  }
}

// ==========================================
// API: AUTHENTICATION (Real Login & Change Password)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tên đăng nhập không tồn tại.' });
    }
    
    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'Mật khẩu không chính xác.' });
    }

    let practitioner = null;
    let supervisor = null;

    if (user.role === 'Học viên') {
      const pracRes = await pool.query(`
        SELECT p.*, s.name as supervisor_name 
        FROM practitioners p
        LEFT JOIN supervisors s ON p.supervisor_id = s.id
        WHERE p.user_id = $1
      `, [user.id]);
      if (pracRes.rows.length > 0) practitioner = pracRes.rows[0];
    } else if (user.role === 'Người hướng dẫn') {
      const supRes = await pool.query('SELECT * FROM supervisors WHERE user_id = $1', [user.id]);
      if (supRes.rows.length > 0) supervisor = supRes.rows[0];
    }

    res.json({
      user,
      practitioner,
      supervisor
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/session-reload', async (req, res) => {
  const { userId } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    }
    
    const user = result.rows[0];
    let practitioner = null;
    let supervisor = null;

    if (user.role === 'Học viên') {
      const pracRes = await pool.query(`
        SELECT p.*, s.name as supervisor_name 
        FROM practitioners p
        LEFT JOIN supervisors s ON p.supervisor_id = s.id
        WHERE p.user_id = $1
      `, [user.id]);
      if (pracRes.rows.length > 0) practitioner = pracRes.rows[0];
    } else if (user.role === 'Người hướng dẫn') {
      const supRes = await pool.query('SELECT * FROM supervisors WHERE user_id = $1', [user.id]);
      if (supRes.rows.length > 0) supervisor = supRes.rows[0];
    }

    res.json({
      user,
      practitioner,
      supervisor
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  try {
    const userRes = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    }

    const currentPassword = userRes.rows[0].password;
    if (currentPassword !== oldPassword) {
      return res.status(400).json({ error: 'Mật khẩu cũ không chính xác.' });
    }

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, userId]);
    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, name, email, phone, created_at FROM users ORDER BY role ASC, name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: SUPERVISORS
// ==========================================
app.get('/api/supervisors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, COUNT(p.id) as active_trainees 
      FROM supervisors s
      LEFT JOIN practitioners p ON s.id = p.supervisor_id AND p.status = 'Đang thực hành'
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/supervisors', async (req, res) => {
  const { name, dob, gender, email, phone, license_number, specialty, license_date, username, password, department } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create corresponding user account first
    const uRes = await client.query(
      `INSERT INTO users (username, password, role, name, email, phone)
       VALUES ($1, $2, 'Người hướng dẫn', $3, $4, $5) RETURNING id`,
      [username || `ns_${license_number.replace(/\//g, '_')}`, password || '123456', name, email, phone]
    );
    const userId = uRes.rows[0].id;

    const result = await client.query(
      `INSERT INTO supervisors (user_id, name, dob, gender, email, phone, license_number, specialty, license_date, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        userId,
        name,
        dob && dob.trim() !== '' ? dob : null,
        gender && gender.trim() !== '' ? gender : null,
        email && email.trim() !== '' ? email : null,
        phone && phone.trim() !== '' ? phone : null,
        license_number,
        specialty,
        license_date && license_date.trim() !== '' ? license_date : null,
        department && department.trim() !== '' ? department : null
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error adding supervisor:", err);
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/supervisors/:id', async (req, res) => {
  try {
    const sRes = await pool.query('SELECT user_id FROM supervisors WHERE id = $1', [req.params.id]);
    if (sRes.rows.length > 0 && sRes.rows[0].user_id) {
      await pool.query('DELETE FROM users WHERE id = $1', [sRes.rows[0].user_id]);
    }
    await pool.query('DELETE FROM supervisors WHERE id = $1', [req.params.id]);
    res.json({ message: 'Supervisor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: PRACTITIONERS
// ==========================================
app.get('/api/practitioners', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, s.name as supervisor_name 
      FROM practitioners p
      LEFT JOIN supervisors s ON p.supervisor_id = s.id
      ORDER BY p.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/practitioners/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, s.name as supervisor_name, s.license_number as supervisor_license, s.specialty as supervisor_specialty
      FROM practitioners p
      LEFT JOIN supervisors s ON p.supervisor_id = s.id
      WHERE p.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Practitioner not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/practitioners', async (req, res) => {
  const { name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, username, password, avatar_url, degree_scan_url } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create user account first
    const uRes = await client.query(
      `INSERT INTO users (username, password, role, name, email, phone)
       VALUES ($1, $2, 'Học viên', $3, $4, $5) RETURNING id`,
      [username || `hv_${Date.now()}`, password || '123456', name, email, phone]
    );
    const userId = uRes.rows[0].id;

    // Create practitioner profile
    const result = await client.query(
      `INSERT INTO practitioners (user_id, name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, status, profile_status, avatar_url, degree_scan_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Đang thực hành', 'Chờ duyệt', $12, $13) RETURNING *`,
      [userId, name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, avatar_url, degree_scan_url]
    );

    // Create a notification for the manager
    await client.query(`
      INSERT INTO notifications (user_id, title, message)
      SELECT id, 'Hồ sơ thực hành mới chờ duyệt', $1 FROM users WHERE role = 'Cán bộ quản lý' LIMIT 1
    `, [`Học viên ${name} đăng ký thực hành chức danh ${specialty} chờ được xét duyệt hồ sơ.`]);

    // Seed default rotation stages sequentially starting from start_date
    await seedDefaultRotations(client, result.rows[0].id, program, specialty, start_date, result.rows[0].supervisor_id);

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error adding practitioner:", err);
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/practitioners/:id', async (req, res) => {
  const { name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, status, profile_status, rejection_reason, avatar_url, degree_scan_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE practitioners 
       SET name=$1, dob=$2, gender=$3, email=$4, phone=$5, degree=$6, specialty=$7, program=$8, start_date=$9, supervisor_id=$10, status=$11, profile_status=$12, rejection_reason=$13, avatar_url=COALESCE($14, avatar_url), degree_scan_url=COALESCE($15, degree_scan_url)
       WHERE id=$16 RETURNING *`,
      [name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, status, profile_status, rejection_reason, avatar_url, degree_scan_url, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// A.03: Approve or reject profile
app.post('/api/practitioners/:id/approve', async (req, res) => {
  const { status, reason } = req.body; // 'Đã duyệt' or 'Từ chối'
  try {
    const pracRes = await pool.query('SELECT * FROM practitioners WHERE id = $1', [req.params.id]);
    if (pracRes.rows.length === 0) return res.status(404).json({ error: 'Practitioner profile not found' });
    const prac = pracRes.rows[0];

    const result = await pool.query(
      'UPDATE practitioners SET profile_status = $1, rejection_reason = $2 WHERE id = $3 RETURNING *',
      [status, reason || null, req.params.id]
    );

    // Send notification to trainee
    if (prac.user_id) {
      const msg = status === 'Đã duyệt' 
        ? 'Hồ sơ đăng ký thực hành của bạn tại TTYT Liên Chiểu đã được duyệt thành công.' 
        : `Hồ sơ thực hành của bạn bị từ chối duyệt. Lý do: ${reason}`;
      await pool.query('INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)', [prac.user_id, 'Kết quả duyệt hồ sơ', msg]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// A.04: Assign supervisor
app.post('/api/practitioners/:id/assign-supervisor', async (req, res) => {
  const { supervisorId } = req.body;
  try {
    const result = await pool.query(
      'UPDATE practitioners SET supervisor_id = $1 WHERE id = $2 RETURNING *',
      [supervisorId, req.params.id]
    );
    
    const p = result.rows[0];
    const sRes = await pool.query('SELECT name FROM supervisors WHERE id = $1', [supervisorId]);
    const sName = sRes.rows.length > 0 ? sRes.rows[0].name : '';

    if (p.user_id) {
      await pool.query('INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)', [
        p.user_id, 
        'Phân công người hướng dẫn', 
        `Bạn đã được chỉ định người hướng dẫn chuyên môn mới là: ${sName}.`
      ]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// C.03: Log competency test result
app.post('/api/practitioners/:id/national-test', async (req, res) => {
  const { score, result, test_date } = req.body;
  try {
    const updateRes = await pool.query(
      `UPDATE practitioners 
       SET national_test_score = $1, national_test_result = $2, national_test_date = $3
       WHERE id = $4 RETURNING *`,
      [score, result, test_date, req.params.id]
    );

    const p = updateRes.rows[0];
    if (p.user_id) {
      await pool.query('INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)', [
        p.user_id,
        'Kết quả kiểm tra đánh giá năng lực',
        `Kết quả kỳ thi ngày ${new Date(test_date).toLocaleDateString('vi-VN')} của bạn: ${result} (Điểm số: ${score})`
      ]);
    }

    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/practitioners/:id', async (req, res) => {
  try {
    const pRes = await pool.query('SELECT user_id FROM practitioners WHERE id = $1', [req.params.id]);
    if (pRes.rows.length > 0 && pRes.rows[0].user_id) {
      await pool.query('DELETE FROM users WHERE id = $1', [pRes.rows[0].user_id]);
    }
    await pool.query('DELETE FROM practitioners WHERE id = $1', [req.params.id]);
    res.json({ message: 'Practitioner deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: PRACTITIONER ROTATIONS (TIMELINE)
// ==========================================

// Get rotations for a trainee
app.get('/api/practitioners/:id/rotations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, s.name as supervisor_name 
       FROM practitioner_rotations r
       LEFT JOIN supervisors s ON r.supervisor_id = s.id
       WHERE r.practitioner_id = $1 
       ORDER BY r.order_index ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a rotation stage for a trainee
app.post('/api/practitioners/:id/rotations', async (req, res) => {
  const { name, duration, start_date, end_date, status, order_index, supervisor_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO practitioner_rotations (practitioner_id, name, duration, start_date, end_date, status, order_index, supervisor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.params.id, name, duration, start_date || null, end_date || null, status || 'Chờ xoay khoa', order_index || 0, supervisor_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a rotation stage
app.put('/api/rotations/:id', async (req, res) => {
  const { name, duration, start_date, end_date, status, order_index, supervisor_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE practitioner_rotations
       SET name=$1, duration=$2, start_date=$3, end_date=$4, status=$5, order_index=$6, supervisor_id=$7
       WHERE id=$8 RETURNING *`,
      [name, duration, start_date || null, end_date || null, status || 'Chờ xoay khoa', order_index || 0, supervisor_id || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a rotation stage
app.delete('/api/rotations/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM practitioner_rotations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Rotation stage deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset rotations to default program template
app.post('/api/practitioners/:id/rotations/reset', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Fetch practitioner program & specialty & start_date & supervisor_id
    const pRes = await client.query('SELECT program, specialty, start_date, supervisor_id FROM practitioners WHERE id = $1', [req.params.id]);
    if (pRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Practitioner not found' });
    }
    const { program, specialty, start_date, supervisor_id } = pRes.rows[0];

    // Delete existing rotations
    await client.query('DELETE FROM practitioner_rotations WHERE practitioner_id = $1', [req.params.id]);

    // Seed default
    await seedDefaultRotations(client, req.params.id, program, specialty, start_date, supervisor_id);

    await client.query('COMMIT');
    
    // Fetch newly seeded rotations
    const result = await client.query(
      `SELECT r.*, s.name as supervisor_name 
       FROM practitioner_rotations r
       LEFT JOIN supervisors s ON r.supervisor_id = s.id
       WHERE r.practitioner_id = $1 
       ORDER BY r.order_index ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get all rotations for reports
app.get('/api/rotations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, p.name as practitioner_name, p.degree as practitioner_degree, p.specialty as practitioner_specialty, s.name as supervisor_name
      FROM practitioner_rotations r
      JOIN practitioners p ON r.practitioner_id = p.id
      LEFT JOIN supervisors s ON r.supervisor_id = s.id
      ORDER BY p.name ASC, r.order_index ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: DEPARTMENTS
// ==========================================
app.get('/api/departments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/departments', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO departments (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM departments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: PRACTICE LOGS (Daily Logs)
// ==========================================
app.get('/api/logs', async (req, res) => {
  const { practitionerId } = req.query;
  try {
    let query = 'SELECT * FROM practice_logs';
    const params = [];
    if (practitionerId) {
      query += ' WHERE practitioner_id = $1 ORDER BY log_date DESC';
      params.push(practitionerId);
    } else {
      query += ' ORDER BY log_date DESC';
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logs', async (req, res) => {
  const { practitioner_id, log_date, department, content, procedures, quantity } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO practice_logs (practitioner_id, log_date, department, content, procedures, quantity, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Chờ xác nhận') RETURNING *`,
      [practitioner_id, log_date, department, content, procedures, quantity || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/logs/:id', async (req, res) => {
  const { status, supervisor_comment } = req.body;
  try {
    const result = await pool.query(
      `UPDATE practice_logs SET status=$1, supervisor_comment=$2 WHERE id=$3 RETURNING *`,
      [status, supervisor_comment, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: EVALUATIONS
// ==========================================
app.get('/api/evaluations', async (req, res) => {
  const { practitionerId } = req.query;
  try {
    let query = `
      SELECT e.*, s.name as evaluator_name 
      FROM evaluations e
      LEFT JOIN supervisors s ON e.evaluator_id = s.id
    `;
    const params = [];
    if (practitionerId) {
      query += ' WHERE e.practitioner_id = $1 ORDER BY e.evaluation_date DESC';
      params.push(practitionerId);
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/evaluations', async (req, res) => {
  const { practitioner_id, department, evaluation_type, rating_specialty, rating_ethics, rating_law, rating_communication, rating_safety, result, comment, evaluator_id } = req.body;
  try {
    // Delete existing evaluation of same type + department
    await pool.query('DELETE FROM evaluations WHERE practitioner_id=$1 AND department=$2 AND evaluation_type=$3', [practitioner_id, department, evaluation_type || 'Định kỳ']);
    
    const resEval = await pool.query(
      `INSERT INTO evaluations (practitioner_id, department, evaluation_type, rating_specialty, rating_ethics, rating_law, rating_communication, rating_safety, result, comment, evaluator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [practitioner_id, department, evaluation_type || 'Định kỳ', rating_specialty, rating_ethics, rating_law, rating_communication, rating_safety, result, comment, evaluator_id]
    );
    res.status(201).json(resEval.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: SUPPLEMENTAL TRAINING
// ==========================================
app.get('/api/training', async (req, res) => {
  const { practitionerId } = req.query;
  try {
    let query = 'SELECT * FROM supplemental_training';
    const params = [];
    if (practitionerId) {
      query += ' WHERE practitioner_id = $1 ORDER BY session_date ASC';
      params.push(practitionerId);
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/training', async (req, res) => {
  const { practitioner_id, session_date, topic, hours, speaker } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO supplemental_training (practitioner_id, session_date, topic, hours, speaker)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [practitioner_id, session_date, topic, hours, speaker]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/training/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM supplemental_training WHERE id = $1', [req.params.id]);
    res.json({ message: 'Training session deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: NOTIFICATIONS
// ==========================================
app.get('/api/notifications', async (req, res) => {
  const { userId } = req.query;
  try {
    let query = 'SELECT * FROM notifications';
    const params = [];
    if (userId) {
      query += ' WHERE user_id = $1 ORDER BY created_at DESC';
      params.push(userId);
    } else {
      query += ' ORDER BY created_at DESC';
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  const { userId } = req.body;
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
    res.json({ message: 'Marked all notifications as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API: SYSTEM BACKUP & RESTORE SIMULATION
// ==========================================
let backupStore = null;

app.post('/api/system/backup', async (req, res) => {
  try {
    const sups = await pool.query('SELECT * FROM supervisors');
    const pracs = await pool.query('SELECT * FROM practitioners');
    const logs = await pool.query('SELECT * FROM practice_logs');
    const evals = await pool.query('SELECT * FROM evaluations');
    const trains = await pool.query('SELECT * FROM supplemental_training');
    const rots = await pool.query('SELECT * FROM practitioner_rotations');
    const users = await pool.query('SELECT * FROM users');
    const depts = await pool.query('SELECT * FROM departments');

    backupStore = {
      timestamp: new Date(),
      users: users.rows,
      supervisors: sups.rows,
      practitioners: pracs.rows,
      logs: logs.rows,
      evaluations: evals.rows,
      training: trains.rows,
      rotations: rots.rows,
      departments: depts.rows
    };

    res.json({
      message: 'Hệ thống đã được sao lưu thành công!',
      timestamp: backupStore.timestamp,
      summary: {
        users: backupStore.users.length,
        supervisors: backupStore.supervisors.length,
        practitioners: backupStore.practitioners.length,
        logs: backupStore.logs.length,
        evaluations: backupStore.evaluations.length,
        training: backupStore.training.length,
        rotations: backupStore.rotations.length,
        departments: backupStore.departments.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/restore', async (req, res) => {
  if (!backupStore) {
    return res.status(400).json({ error: 'Chưa có bản sao lưu nào trong phiên hoạt động hiện tại.' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Clear existing
    await client.query('DELETE FROM notifications;');
    await client.query('DELETE FROM supplemental_training;');
    await client.query('DELETE FROM evaluations;');
    await client.query('DELETE FROM practice_logs;');
    await client.query('DELETE FROM practitioner_rotations;');
    await client.query('DELETE FROM practitioners;');
    await client.query('DELETE FROM supervisors;');
    await client.query('DELETE FROM users;');
    await client.query('DELETE FROM departments;');

    // Restore Users
    for (const u of backupStore.users) {
      await client.query(
        'INSERT INTO users (id, username, password, role, name, email, phone, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [u.id, u.username, u.password, u.role, u.name, u.email, u.phone, u.created_at]
      );
    }

    // Restore Supervisors
    for (const s of backupStore.supervisors) {
      await client.query(
        'INSERT INTO supervisors (id, user_id, name, dob, gender, email, phone, license_number, specialty, license_date, department, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [s.id, s.user_id, s.name, s.dob, s.gender, s.email, s.phone, s.license_number, s.specialty, s.license_date, s.department, s.created_at]
      );
    }

    // Restore Departments
    if (backupStore.departments) {
      for (const d of backupStore.departments) {
        await client.query(
          'INSERT INTO departments (id, name, created_at) VALUES ($1, $2, $3)',
          [d.id, d.name, d.created_at]
        );
      }
    }

    // Restore Practitioners
    for (const p of backupStore.practitioners) {
      await client.query(
        `INSERT INTO practitioners (id, user_id, name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, status, profile_status, rejection_reason, avatar_url, degree_scan_url, national_test_score, national_test_result, national_test_date, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [p.id, p.user_id, p.name, p.dob, p.gender, p.email, p.phone, p.degree, p.specialty, p.program, p.start_date, p.supervisor_id, p.status, p.profile_status, p.rejection_reason, p.avatar_url, p.degree_scan_url, p.national_test_score, p.national_test_result, p.national_test_date, p.created_at]
      );
    }

    // Restore Rotations
    if (backupStore.rotations) {
      for (const r of backupStore.rotations) {
        await client.query(
          'INSERT INTO practitioner_rotations (id, practitioner_id, name, duration, start_date, end_date, status, order_index, supervisor_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [r.id, r.practitioner_id, r.name, r.duration, r.start_date, r.end_date, r.status, r.order_index, r.supervisor_id, r.created_at]
        );
      }
    }

    // Restore Logs
    for (const l of backupStore.logs) {
      await client.query(
        'INSERT INTO practice_logs (id, practitioner_id, log_date, department, content, procedures, quantity, status, supervisor_comment, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [l.id, l.practitioner_id, l.log_date, l.department, l.content, l.procedures, l.quantity, l.status, l.supervisor_comment, l.created_at]
      );
    }

    // Restore Evaluations
    for (const e of backupStore.evaluations) {
      await client.query(
        'INSERT INTO evaluations (id, practitioner_id, department, evaluation_type, rating_specialty, rating_ethics, rating_law, rating_communication, rating_safety, result, comment, evaluator_id, evaluation_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
        [e.id, e.practitioner_id, e.department, e.evaluation_type, e.rating_specialty, e.rating_ethics, e.rating_law, e.rating_communication, e.rating_safety, e.result, e.comment, e.evaluator_id, e.evaluation_date, e.created_at]
      );
    }

    // Restore Training
    for (const t of backupStore.training) {
      await client.query(
        'INSERT INTO supplemental_training (id, practitioner_id, session_date, topic, hours, speaker, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [t.id, t.practitioner_id, t.session_date, t.topic, t.hours, t.speaker, t.created_at]
      );
    }

    // Reset SERIAL sequences
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;");
    await client.query("SELECT setval(pg_get_serial_sequence('departments', 'id'), COALESCE(MAX(id), 1)) FROM departments;");
    await client.query("SELECT setval(pg_get_serial_sequence('supervisors', 'id'), COALESCE(MAX(id), 1)) FROM supervisors;");
    await client.query("SELECT setval(pg_get_serial_sequence('practitioners', 'id'), COALESCE(MAX(id), 1)) FROM practitioners;");
    await client.query("SELECT setval(pg_get_serial_sequence('practitioner_rotations', 'id'), COALESCE(MAX(id), 1)) FROM practitioner_rotations;");
    await client.query("SELECT setval(pg_get_serial_sequence('practice_logs', 'id'), COALESCE(MAX(id), 1)) FROM practice_logs;");
    await client.query("SELECT setval(pg_get_serial_sequence('evaluations', 'id'), COALESCE(MAX(id), 1)) FROM evaluations;");
    await client.query("SELECT setval(pg_get_serial_sequence('supplemental_training', 'id'), COALESCE(MAX(id), 1)) FROM supplemental_training;");

    await client.query('COMMIT');
    res.json({ message: 'Hệ thống đã phục hồi dữ liệu từ bản sao lưu thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
