const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Neon PostgreSQL Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 4, // limit max connections per serverless instance to prevent Neon DB connection exhaustion
  idleTimeoutMillis: 15000, // close idle connections quickly (15s) to free up DB pool
  connectionTimeoutMillis: 5000 // fail fast (5s) if database connection is stuck to prevent requests hanging
});

// Configure SMTP mail transporter for sending credentials to trainees
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

async function sendWelcomeEmail(email, name, username, password) {
  if (!email) {
    console.log(`[Email Mock] Skip sending welcome email for ${name}: No email address provided.`);
    return;
  }
  
  const mailOptions = {
    from: `"Hệ thống QLHN" <${process.env.SMTP_FROM || 'no-reply@qlhn-bvlc.gov.vn'}>`,
    to: email,
    subject: 'Thông tin tài khoản đăng nhập Hệ thống Quản lý Thực hành Y khoa',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #007bff; text-align: center;">Thông Báo Cấp Tài Khoản Đăng Nhập</h2>
        <p>Kính gửi Anh/Chị <strong>${name}</strong>,</p>
        <p>Hồ sơ đăng ký thực hành y khoa của Anh/Chị đã được tiếp nhận thành công vào hệ thống quản lý thực hành của Bệnh viện. Dưới đây là thông tin tài khoản để truy cập hệ thống:</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 5px 0;"><strong>Đường dẫn truy cập:</strong> <a href="${process.env.SYSTEM_URL || 'http://localhost:3000'}" style="color: #007bff; text-decoration: none;">Đăng nhập hệ thống</a></p>
          <p style="margin: 5px 0;"><strong>Tên đăng nhập:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 15px; color: #e83e8c;">${username}</code></p>
          <p style="margin: 5px 0;"><strong>Mật khẩu mặc định:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 15px; color: #e83e8c;">${password}</code></p>
        </div>
        <p style="color: #dc3545;">* Lưu ý: Anh/Chị vui lòng đăng nhập hệ thống và thay đổi mật khẩu ngay trong lần đăng nhập đầu tiên để đảm bảo bảo mật thông tin.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6c757d; text-align: center;">Đây là email tự động từ Hệ thống Quản lý Thực hành Y khoa. Vui lòng không trả lời email này.</p>
      </div>
    `
  };

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`
=========================================
[SMTP NOT CONFIGURING - EMAIL MOCK LOGGER]
To: ${email}
Subject: ${mailOptions.subject}
Body:
Tài khoản: ${username}
Mật khẩu: ${password}
=========================================
    `);
    return;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email Welcome] Sent successfully to ${email}`);
  } catch (err) {
    console.error(`[Email Welcome] Failed to send email to ${email}:`, err.message);
  }
}

// Configure JSON payload limit to support large base64 uploads (e.g. scans up to 10MB)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

async function seedSupervisors(client) {
  const supervisorList = [
    // I. Nội khoa
    { name: 'Nguyễn Thị Ly Na', license_number: '006946/ĐNA-CCHN', license_date: '2017-08-21', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'nguyenthilyna' },
    { name: 'Lê Việt Trung', license_number: '006633/ĐNA-CCHN', license_date: '2017-04-12', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'leviettrung' },
    { name: 'Nguyễn Thị Châu Loan', license_number: '007345/ĐNA-CCHN', license_date: '2018-03-21', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'nguyenthichauloan' },
    { name: 'Trần Lê Nhật Ly', license_number: '007337/ĐNA-CCHN', license_date: '2018-03-21', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'tranlenhatly' },
    { name: 'Nguyễn Văn Linh', license_number: '007973/ĐNA-CCHN', license_date: '2019-04-11', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'nguyenvanlinh' },
    { name: 'Trần Thị Thu Thương', license_number: '007983/ĐNA-CCHN', license_date: '2019-04-16', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'tranthithuthuong' },
    { name: 'Trần Thị Thanh Nga', license_number: '005910/ĐNA-CCHN', license_date: '2016-02-18', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'tranthithanhnga' },
    { name: 'Chu Lan Huệ', license_number: '008000/ĐNA-CCHN', license_date: '2019-04-18', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'chulanhue' },
    { name: 'Trần Duy Hòa', license_number: '008633/ĐNA-CCHN', license_date: '2020-02-24', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'tranduyhoa' },
    { name: 'Trương Đạt Hướng', license_number: '008640/ĐNA-CCHN', license_date: '2020-02-24', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'truongdathuong' },
    { name: 'Đoàn Thị Ngọc Phước', license_number: '008826/ĐNA-CCHN', license_date: '2020-06-22', specialty: 'Nội khoa', department: 'Khoa Nội tổng hợp', username: 'doanthingocphuoc' },

    // II. Ngoại khoa
    { name: 'Trần Hữu Lâm', license_number: '000534/ĐNA-CCHN', license_date: '2012-09-07', specialty: 'Ngoại khoa', department: 'Khoa Ngoại chấn thương', username: 'tranhuulam' },
    { name: 'Phạm Tuấn Anh', license_number: '005988/ĐNA-CCHN', license_date: '2016-04-20', specialty: 'Ngoại khoa', department: 'Khoa Ngoại chấn thương', username: 'phamtuananh' },
    { name: 'Phan Thế Công', license_number: '005985/ĐNA-CCHN', license_date: '2018-03-21', specialty: 'Ngoại khoa', department: 'Khoa Ngoại chấn thương', username: 'phanthecong' },
    { name: 'Nguyễn Tô Hoài', license_number: '004601/ĐNA-CCHN', license_date: '2014-09-06', specialty: 'Ngoại khoa', department: 'Khoa Ngoại chấn thương', username: 'nguyentohoai' },
    { name: 'Phan Võ Thanh Kháng', license_number: '008644/ĐNA-CCHN', license_date: '2020-02-24', specialty: 'Ngoại khoa', department: 'Khoa Ngoại chấn thương', username: 'phanvothanhkhang' },
    { name: 'Lê Đức Thọ', license_number: '008642/ĐNA-CCHN', license_date: '2020-02-24', specialty: 'Ngoại khoa', department: 'Khoa Ngoại chấn thương', username: 'leductho' },

    // III. Nhi khoa
    { name: 'Phan Thị Ngọc Yên', license_number: '007344/ĐNA-CCHN', license_date: '2018-03-21', specialty: 'Nhi khoa', department: 'Khoa Nhi', username: 'phanthingocyen' },
    { name: 'Phan Châu Yên Nhi', license_number: '008627/ĐNA-CCHN', license_date: '2020-02-24', specialty: 'Nhi khoa', department: 'Khoa Nhi', username: 'phanchauyennhi' },
    { name: 'Trần Thị Vy Vy', license_number: '007916/ĐNA-CCHN', license_date: '2019-03-09', specialty: 'Nhi khoa', department: 'Khoa Nhi', username: 'tranthivyvy' },
    { name: 'Trần Thị Xuân Trang', license_number: '007999/ĐNA-CCHN', license_date: '2019-04-16', specialty: 'Nhi khoa', department: 'Khoa Nhi', username: 'tranthixuantrang' },
    { name: 'Lê Thị Nhật Hà', license_number: '008647/ĐNA-CCHN', license_date: '2020-02-24', specialty: 'Nhi khoa', department: 'Khoa Nhi', username: 'lethinhatha' },
    { name: 'Nguyễn Phan Liên Hải', license_number: '008689/ĐNA-CCHN', license_date: '2020-03-31', specialty: 'Nhi khoa', department: 'Khoa Nhi', username: 'nguyenphanlienhai' },

    // IV. Sản khoa
    { name: 'Trần Thị Hồng Diệm', license_number: '002635/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Sản phụ khoa', department: 'Khoa Sản phụ khoa', username: 'tranthihongdiem' },
    { name: 'Nguyễn Thị Anh Tâm', license_number: '000245/ĐNA-CCHN', license_date: '2012-07-20', specialty: 'Sản phụ khoa', department: 'Khoa Sản phụ khoa', username: 'nguyenthianhtam' },
    { name: 'Nguyễn Tiến Chung', license_number: '0016998/BYT-CCHN', license_date: '2014-02-28', specialty: 'Sản phụ khoa', department: 'Khoa Sản phụ khoa', username: 'nguyentienchung' },
    { name: 'Nguyễn Văn Liêm', license_number: '009194/ĐNA-CCHN', license_date: '2021-06-01', specialty: 'Sản phụ khoa', department: 'Khoa Sản phụ khoa', username: 'nguyenvanliem' },

    // V. Tai mũi họng
    { name: 'Đoàn Nhật Khánh', license_number: '006457/ĐNA-CCHN', license_date: '2017-01-09', specialty: 'Tai mũi họng', department: 'Khoa Tai Mũi Họng', username: 'doannhatkhanh' },
    { name: 'Nguyễn Văn Lực', license_number: '001009/ĐNA-CCHN', license_date: '2012-11-28', specialty: 'Tai mũi họng', department: 'Khoa Tai Mũi Họng', username: 'nguyenvanluc' },

    // VI. Mắt
    { name: 'Nguyễn Cửu Cường', license_number: '001457/ĐNA-CCHN', license_date: '2013-01-15', specialty: 'Mắt', department: 'Khoa Mắt', username: 'nguyencuucuong' },

    // VII. Y học cổ truyền
    { name: 'Nguyễn Đình Phát', license_number: '002996/ĐNA-CCHN', license_date: '2014-01-21', specialty: 'Y học cổ truyền', department: 'Khoa Y học cổ truyền', username: 'nguyendinhphat' },
    { name: 'Ngô Văn Khanh', license_number: '002733/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Y học cổ truyền', department: 'Khoa Y học cổ truyền', username: 'ngovankhanh' },
    { name: 'Nguyễn Đình Minh Đạt', license_number: '007427/ĐNA-CCHN', license_date: '2018-05-19', specialty: 'Y học cổ truyền', department: 'Khoa Y học cổ truyền', username: 'nguyendinhminhdat' },
    { name: 'Ngô Thị Kiều Vi', license_number: '008649/ĐNA-CCHN', license_date: '2020-02-24', specialty: 'Y học cổ truyền', department: 'Khoa Y học cổ truyền', username: 'ngothikieuvi' },

    // VIII. Hồi sức cấp cứu
    { name: 'Đinh Văn Thiệu', license_number: '006378/ĐNA-CCHN', license_date: '2016-11-23', specialty: 'Hồi sức cấp cứu', department: 'Khoa Hồi sức cấp cứu', username: 'dinhvanthieu' },

    // IX. Da liễu
    { name: 'Nguyễn Thị Thu Phương', license_number: '007391/ĐNA-CCHN', license_date: '2018-04-18', specialty: 'Da liễu', department: 'Khoa Da liễu', username: 'nguyenthithuphuong' },

    // X. Răng hàm mặt
    { name: 'Võ Thị Mỹ Hiệu', license_number: '005742/ĐNA-CCHN', license_date: '2015-12-04', specialty: 'Răng hàm mặt', department: 'Khoa Răng Hàm Mặt', username: 'vothimyhieu' },
    { name: 'Lê Hồng Bảo Ngọc', license_number: '008672/ĐNA-CCHN', license_date: '2020-03-26', specialty: 'Răng hàm mặt', department: 'Khoa Răng Hàm Mặt', username: 'lehongbaongoc' },

    // XI. Dược sĩ
    { name: 'Phan Thị Thu Hương', license_number: '0331/ĐNA-CCHND', license_date: '2014-11-14', specialty: 'Dược sĩ', department: 'Khoa Dược', username: 'phanthithuhuong' },
    { name: 'Nguyễn Thị Tuyết Nhung', license_number: '0016/CCHN-D-SYT-ĐNA', license_date: '2017-12-07', specialty: 'Dược sĩ', department: 'Khoa Dược', username: 'nguyenthituyetnhung' },
    { name: 'Nguyễn Thị Thanh Tùng', license_number: '0588/ĐNA-CCHND', license_date: '2016-07-05', specialty: 'Dược sĩ', department: 'Khoa Dược', username: 'nguyenthithanhtung' },
    { name: 'Lê Thị Kiều Trang', license_number: '0139/CCHN-D-SYT-ĐNA', license_date: '2020-07-07', specialty: 'Dược sĩ', department: 'Khoa Dược', username: 'lethikieutrang' },
    { name: 'Lê Thị Diễm Trinh', license_number: '0590/ĐNA-CCHND', license_date: '2016-07-05', specialty: 'Dược sĩ', department: 'Khoa Dược', username: 'lethidiemtrinh' },
    { name: 'Trần Viết Thành', license_number: '1339/CCHN-D-SYT-ĐNA', license_date: '2021-04-05', specialty: 'Dược sĩ', department: 'Khoa Dược', username: 'tranvietthanh' },
    { name: 'Chế Thị Mỹ Chi', license_number: '1384/CCHN-D-SYT-ĐNA', license_date: '2021-05-14', specialty: 'Dược sĩ', department: 'Khoa Dược', username: 'chethimychi' },

    // XII. Điều dưỡng
    { name: 'Huỳnh Thị Kim Yến', license_number: '002787/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'huynhthikimyen' },
    { name: 'Phan Thị Minh Thuận', license_number: '002896/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Điều dưỡng', department: 'Khoa Nội tổng hợp', username: 'phanthiminhthuan' },
    { name: 'Phạm Thị Thu Hiền', license_number: '002783/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Điều dưỡng', department: 'Khoa Ngoại chấn thương', username: 'phamthithuhien' },
    { name: 'Nguyễn Thị Đang Trang', license_number: '002715/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Sản phụ khoa', username: 'nguyenthidangtrang' },
    { name: 'Phạm Thị Vân', license_number: '002788/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Nhi', username: 'phamthivan' },
    { name: 'Ngô Thị Vân Na', license_number: '002800/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'ngothivanna' },
    { name: 'Châu Thị Minh Phương', license_number: '002779/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Nội tổng hợp', username: 'chauthiminhphuong' },
    { name: 'Nguyễn Thị Thùy Nhung', license_number: '004750/ĐNA-CCHN', license_date: '2014-10-28', specialty: 'Điều dưỡng', department: 'Khoa Ngoại chấn thương', username: 'nguyenthithuynhung' },
    { name: 'Nguyễn Thị Thực', license_number: '002905/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Sản phụ khoa', username: 'nguyenthithuc' },
    { name: 'Nguyễn Lê Thùy Trang', license_number: '005032/ĐNA-CCHN', license_date: '2015-03-03', specialty: 'Điều dưỡng', department: 'Khoa Nhi', username: 'nguyenlethuytrang' },
    { name: 'Nguyễn Thị Minh Châu', license_number: '005419/QNA-CCHN', license_date: '2016-12-28', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'nguyenthiminhchau' },
    { name: 'Dương Thị Kim Phương', license_number: '003466/QNA-CCHN', license_date: '2014-06-26', specialty: 'Điều dưỡng', department: 'Khoa Nội tổng hợp', username: 'duongthikimphuong' },
    { name: 'Lê Thị Hồng Liên', license_number: '002569/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Ngoại chấn thương', username: 'lethihonglien' },
    { name: 'Lê Thị Ánh Ngọc', license_number: '004689/ĐNA-CCHN', license_date: '2014-10-28', specialty: 'Điều dưỡng', department: 'Khoa Sản phụ khoa', username: 'lethianhngoc' },
    { name: 'Đặng Thị Thu Thúy', license_number: '002759/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Điều dưỡng', department: 'Khoa Nhi', username: 'dangthithuthuy' },
    { name: 'Nguyễn Thị Kim Anh', license_number: '004747/ĐNA-CCHN', license_date: '2014-10-28', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'nguyenthikimanh' },
    { name: 'Nguyễn Thị Phong', license_number: '002935/ĐNA-CCHN', license_date: '2013-12-28', specialty: 'Điều dưỡng', department: 'Khoa Nội tổng hợp', username: 'nguyenthiphong' },
    { name: 'Võ Thị Ni Na', license_number: '004724/ĐNA-CCHN', license_date: '2014-10-28', specialty: 'Điều dưỡng', department: 'Khoa Ngoại chấn thương', username: 'vothinina' },
    { name: 'Nguyễn Thị Kim Giang', license_number: '002707/ĐNA-CCHN', license_date: '2013-12-22', specialty: 'Điều dưỡng', department: 'Khoa Sản phụ khoa', username: 'nguyenthikimgiang' },
    { name: 'Lê Thị Mỹ Trinh', license_number: '002568/ĐNA-CCHN', license_date: '2013-12-23', specialty: 'Điều dưỡng', department: 'Khoa Nhi', username: 'lethimytrinh' },
    { name: 'Nguyễn Thị Tô Dung', license_number: '002731/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'nguyenthitodung' },
    { name: 'Phan Hoàng Vũ', license_number: '002567/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Nội tổng hợp', username: 'phanhoangvu' },
    { name: 'Nguyễn Cứu Khoa', license_number: '007140/ĐNA-CCHN', license_date: '2017-11-24', specialty: 'Điều dưỡng', department: 'Khoa Ngoại chấn thương', username: 'nguyencuukhoa' },
    { name: 'Trần Thị Thanh Nhựt', license_number: '002795/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Điều dưỡng', department: 'Khoa Sản phụ khoa', username: 'tranthithanhnhut' },
    { name: 'Bùi Thị Non', license_number: '002586/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Nhi', username: 'buithinon' },
    { name: 'Trương Thị Thu Yến', license_number: '002643/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'truongthithuyen' },
    { name: 'Tống Thị Thanh Thủy', license_number: '002595/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Nội tổng hợp', username: 'tongthithanhthuy' },
    { name: 'Nguyễn Thị Phương Thảo', license_number: '004814/ĐNA-CCHN', license_date: '2014-11-18', specialty: 'Điều dưỡng', department: 'Khoa Ngoại chấn thương', username: 'nguyenthiphuongthao' },
    { name: 'Mai Thị Phương', license_number: '002571/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'maithiphuong' },

    // XIII. Điều dưỡng (Hồi sức / Gây mê / Nha khoa) - thêm 8 người
    { name: 'Nguyễn Thị Mỹ Loan', license_number: '002806/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'nguyenthimyloan' },
    { name: 'Lê Thị Diệu Loan', license_number: '008858/ĐNA-CCHN', license_date: '2020-06-30', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'lethidieuloan' },
    { name: 'Phạm Thị Cẩm Thảo', license_number: '002784/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'phamthicamthao' },
    { name: 'Đồng Thị Kim Dung', license_number: '002723/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'dongthikimdung' },
    { name: 'Võ Thị Quỳnh Trang', license_number: '002725/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'vothiquynhtrang' },
    { name: 'Mạc Như Quang', license_number: '006678/ĐNA-CCHN', license_date: '2017-05-15', specialty: 'Điều dưỡng', department: 'Khoa Hồi sức cấp cứu', username: 'macnhuquang' },
    { name: 'Phạm Hoàng Phúc', license_number: '008793/ĐNA-CCHN', license_date: '2020-06-05', specialty: 'Điều dưỡng', department: 'Khoa Răng Hàm Mặt', username: 'phamhoangphuc' },
    { name: 'Nguyễn Trần Uy Kha', license_number: '002704/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Điều dưỡng', department: 'Khoa Răng Hàm Mặt', username: 'nguyentranuykha' },

    // XIV. Hộ sinh - 8 người
    { name: 'Hoàng Thị Minh Phương', license_number: '002765/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Hộ sinh', department: 'Khoa Sản phụ khoa', username: 'hoangthiminhphuong' },
    { name: 'Nguyễn Thị Đỗ Quyên', license_number: '002862/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Hộ sinh', department: 'Khoa Sản phụ khoa', username: 'nguyenthidoquyen' },
    { name: 'Trương Thị Lệ Tảo', license_number: '002632/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Hộ sinh', department: 'Khoa Sản phụ khoa', username: 'truongthiletao' },
    { name: 'Dương Thị Ái Hương', license_number: '002906/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Hộ sinh', department: 'Khoa Sản phụ khoa', username: 'duongthiaihuong' },
    { name: 'Lê Thị Phượng', license_number: '003744/ĐNA-CCHN', license_date: '2014-11-04', specialty: 'Hộ sinh', department: 'Khoa Sản phụ khoa', username: 'lethiphuong' },
    { name: 'Trần Thị Mẫn Linh', license_number: '002714/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Hộ sinh', department: 'Khoa Sản phụ khoa', username: 'tranthimanlinh' },
    { name: 'Nguyễn Thị Thanh Hiệp', license_number: '002631/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Hộ sinh', department: 'Khoa Sản phụ khoa', username: 'nguyenthithanhhiep' },
    { name: 'Ngô Thị Thanh Thủy', license_number: '002860/ĐNA-CCHN', license_date: '2013-12-27', specialty: 'Hộ sinh', department: 'Khoa Sản phụ khoa', username: 'ngothithanhthuy' },

    // XV. Kỹ thuật viên Xét nghiệm - 8 người
    { name: 'Trần Quang Vũ', license_number: '002602/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Kỹ thuật viên Xét nghiệm', department: 'Khoa Xét nghiệm', username: 'tranquangvu' },
    { name: 'Trần Thị Hòa', license_number: '006734/ĐNA-CCHN', license_date: '2017-05-06', specialty: 'Kỹ thuật viên Xét nghiệm', department: 'Khoa Xét nghiệm', username: 'tranthihoa' },
    { name: 'Nguyễn Đình Khánh', license_number: '004793/ĐNA-CCHN', license_date: '2014-11-18', specialty: 'Kỹ thuật viên Xét nghiệm', department: 'Khoa Xét nghiệm', username: 'nguyendinhkhanh' },
    { name: 'Mai Thị Bích Quyên', license_number: '002617/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Kỹ thuật viên Xét nghiệm', department: 'Khoa Xét nghiệm', username: 'maithibichquyen' },
    { name: 'Nguyễn Thị Phú', license_number: '0005476/ĐNA-CCHN', license_date: '2015-08-14', specialty: 'Kỹ thuật viên Xét nghiệm', department: 'Khoa Xét nghiệm', username: 'nguyenthiphu' },
    { name: 'Nguyễn Thị Thu Thủy', license_number: '002605/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Kỹ thuật viên Xét nghiệm', department: 'Khoa Xét nghiệm', username: 'nguyenthithuthuy' },
    { name: 'Lê Thị Thùy Chiêu', license_number: '002701/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Kỹ thuật viên Xét nghiệm', department: 'Khoa Xét nghiệm', username: 'lethithuychieu' },
    { name: 'Trần Thị Thập Linh', license_number: '004591/ĐNA-CCHN', license_date: '2014-09-06', specialty: 'Kỹ thuật viên Xét nghiệm', department: 'Khoa Xét nghiệm', username: 'tranthithaplinh' },

    // XVI. Kỹ thuật viên Hình ảnh - 5 người
    { name: 'Trần Văn Học', license_number: '002616/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Kỹ thuật viên Hình ảnh', department: 'Khoa Chẩn đoán hình ảnh', username: 'tranvanhoc' },
    { name: 'Bùi Triệu Phú', license_number: '002614/ĐNA-CCHN', license_date: '2023-12-29', specialty: 'Kỹ thuật viên Hình ảnh', department: 'Khoa Chẩn đoán hình ảnh', username: 'buitrieuphu' },
    { name: 'Thái Anh Tuân', license_number: '002604/ĐNA-CCHN', license_date: '2023-12-29', specialty: 'Kỹ thuật viên Hình ảnh', department: 'Khoa Chẩn đoán hình ảnh', username: 'thaianhtuan' },
    { name: 'Nguyễn Quốc Hoàng', license_number: '0005174/ĐNA-CCHN', license_date: '2015-05-20', specialty: 'Kỹ thuật viên Hình ảnh', department: 'Khoa Chẩn đoán hình ảnh', username: 'nguyenquochoang' },
    { name: 'Tạ Thị Bình', license_number: '005448/ĐNA-CCHN', license_date: '2015-08-14', specialty: 'Kỹ thuật viên Hình ảnh', department: 'Khoa Chẩn đoán hình ảnh', username: 'tathibinh' },

    // XVII. Kỹ thuật viên Phục hồi chức năng - 3 người
    { name: 'Nguyễn Thị Lợi', license_number: '002603/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Kỹ thuật viên Phục hồi chức năng', department: 'Khoa YHCT-PHCN', username: 'nguyenthiloi' },
    { name: 'Trương Thị Thu Thủy', license_number: '002915/ĐNA-CCHN', license_date: '2022-11-18', specialty: 'Kỹ thuật viên Phục hồi chức năng', department: 'Khoa YHCT-PHCN', username: 'truongthithuthuy' },
    { name: 'Nguyễn Thị Đằng', license_number: '002711/ĐNA-CCHN', license_date: '2013-12-12', specialty: 'Kỹ thuật viên Phục hồi chức năng', department: 'Khoa YHCT-PHCN', username: 'nguyenthidang' }
  ];

  for (const s of supervisorList) {
    // Check if license number exists in supervisors table
    const check = await client.query('SELECT id FROM supervisors WHERE license_number = $1', [s.license_number]);
    if (check.rows.length === 0) {
      // Create user account first
      let userId = null;
      const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [s.username]);
      if (userCheck.rows.length > 0) {
        userId = userCheck.rows[0].id;
      } else {
        const uRes = await client.query(
          `INSERT INTO users (username, password, role, name, email, phone)
           VALUES ($1, $2, 'Người hướng dẫn', $3, $4, $5) RETURNING id`,
          [s.username, 'LienChieu@2026', s.name, `${s.username}@lienchieu.gov.vn`, '0900000000']
        );
        userId = uRes.rows[0].id;
      }
      
      // Insert supervisor record
      await client.query(
        `INSERT INTO supervisors (user_id, name, license_number, specialty, license_date, department)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, s.name, s.license_number, s.specialty, s.license_date, s.department]
      );
    }
  }
}

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
    await client.query(`
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS rating_knowledge VARCHAR(50);
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS rating_skills VARCHAR(50);
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS rating_experience VARCHAR(50);
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS rating_growth VARCHAR(50);
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS rating_attitude VARCHAR(50);
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS rating_discipline VARCHAR(50);
    `);

    // 9. Create System Settings / Metadata Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_metadata (
        key VARCHAR(50) PRIMARY KEY,
        value VARCHAR(255)
      );
    `);

    // 10. Create System Backups Table (Neon persistent backup)
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_backups (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        backup_data JSONB NOT NULL,
        summary JSONB NOT NULL
      );
    `);

    // 11. Create Indexes for performance optimization (foreign keys & search columns)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_practitioner_rotations_practitioner ON practitioner_rotations(practitioner_id);
      CREATE INDEX IF NOT EXISTS idx_practitioner_rotations_supervisor ON practitioner_rotations(supervisor_id);
      CREATE INDEX IF NOT EXISTS idx_practice_logs_practitioner ON practice_logs(practitioner_id);
      CREATE INDEX IF NOT EXISTS idx_practice_logs_rotation ON practice_logs(rotation_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_practitioner ON evaluations(practitioner_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator ON evaluations(evaluator_id);
      CREATE INDEX IF NOT EXISTS idx_supplemental_training_practitioner ON supplemental_training(practitioner_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_supervisors_username ON supervisors(username);
      CREATE INDEX IF NOT EXISTS idx_practitioners_username ON practitioners(username);
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

    // Check if initial seeding has already been completed
    const seedCheck = await client.query("SELECT value FROM system_metadata WHERE key = 'initial_seed_completed'");
    const isSeedCompleted = seedCheck.rows.length > 0 && seedCheck.rows[0].value === 'true';

    if (!isSeedCompleted) {
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
        'Khoa Y học cổ truyền',
        'Khoa Da liễu',
        'Khoa Dược',
        'Khoa Xét nghiệm',
        'Khoa Chẩn đoán hình ảnh',
        'Phòng Đào tạo'
      ];
      for (const dept of defaultDepts) {
        await client.query('INSERT INTO departments (name) VALUES ($1) ON CONFLICT DO NOTHING', [dept]);
      }

      console.log('Seeding default supervisors from official list...');
      await seedSupervisors(client);

      await client.query("INSERT INTO system_metadata (key, value) VALUES ('initial_seed_completed', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'");
      console.log('Initial seeding completed successfully and flagged.');
    } else {
      console.log('Initial seeding already completed previously. Skipping departments and supervisors seeding to preserve user modifications.');
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

// Support Lazy Database Initialization for Serverless environments (like Vercel)
let dbInitialized = false;
let dbInitializationPromise = null;

async function ensureDbInitialized() {
  if (dbInitialized) return;
  if (!dbInitializationPromise) {
    dbInitializationPromise = initializeDatabase().then(() => {
      dbInitialized = true;
    });
  }
  await dbInitializationPromise;
}

// Middleware to auto-initialize Neon database on first request
app.use(async (req, res, next) => {
  try {
    await ensureDbInitialized();
    next();
  } catch (err) {
    console.error('Database initialization failed:', err);
    res.status(500).json({ error: 'Database initialization failed: ' + err.message });
  }
});

// Start server locally (if not on Vercel)
if (!process.env.VERCEL) {
  ensureDbInitialized().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to initialize database locally:', err);
  });
}

async function recalculateRotationDates(client, practitionerId) {
  // Fetch practitioner's start_date
  const pRes = await client.query('SELECT start_date FROM practitioners WHERE id = $1', [practitionerId]);
  if (pRes.rows.length === 0) return;
  const startDateVal = pRes.rows[0].start_date;
  if (!startDateVal) return;

  // Fetch all rotations ordered by order_index
  const rRes = await client.query(
    'SELECT id, duration FROM practitioner_rotations WHERE practitioner_id = $1 ORDER BY order_index ASC',
    [practitionerId]
  );
  
  let currentDate = new Date(startDateVal);
  for (let i = 0; i < rRes.rows.length; i++) {
    const rot = rRes.rows[i];
    const sDate = new Date(currentDate);
    const eDate = new Date(currentDate);
    
    // Check if duration contains 'tuần' or 'week' or 't'
    const durationLower = rot.duration.toLowerCase();
    if (durationLower.includes('tuần') || durationLower.includes('week') || durationLower.includes('t')) {
      const weeks = parseInt(rot.duration);
      eDate.setDate(eDate.getDate() + (weeks * 7));
    } else {
      const months = parseInt(rot.duration);
      eDate.setMonth(eDate.getMonth() + months);
    }
    
    await client.query(
      'UPDATE practitioner_rotations SET start_date = $1, end_date = $2, order_index = $3 WHERE id = $4',
      [sDate, eDate, i, rot.id]
    );
    
    currentDate = eDate;
  }
}

async function seedDefaultRotations(client, practitionerId, program, specialty, startDateStr, supervisorId) {
  let rotations = [];
  if (program === 'ND96') {
    if (specialty === 'Bác sĩ') {
      rotations = [
        { name: 'Thực hành lâm sàng chuyên khoa Nội (02 tháng)', duration: '8 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Ngoại (02 tháng)', duration: '8 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Sản phụ khoa (01 tháng)', duration: '8 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Nhi (01 tháng)', duration: '8 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Hồi sức cấp cứu (03 tháng)', duration: '12 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Tai mũi họng (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Mắt (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Da liễu (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Tâm thần (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Xét nghiệm (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Chẩn đoán hình ảnh (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Y học cổ truyền – Phục hồi chức năng (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Răng hàm mặt', duration: '1 tuần' }
      ];
    } else if (specialty === 'Bác sĩ Răng hàm mặt') {
      rotations = [
        { name: 'Thực hành lâm sàng chuyên khoa Răng hàm mặt (09 tháng)', duration: '36 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Hồi sức cấp cứu (03 tháng)', duration: '12 tuần' }
      ];
    } else if (specialty === 'Bác sĩ Y học cổ truyền') {
      rotations = [
        { name: 'Thực hành lâm sàng chuyên khoa Y học cổ truyền – Phục hồi chức năng (07 tháng)', duration: '28 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Hồi sức cấp cứu (03 tháng)', duration: '12 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Nội (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Ngoại (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Tai mũi họng (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Mắt (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Răng hàm mặt (01 tuần)', duration: '1 tuần' }
      ];
    } else if (specialty === 'Bác sĩ Y học dự phòng') {
      rotations = [
        { name: 'Thực hành lâm sàng chuyên khoa Nội (02 tháng)', duration: '8 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Ngoại (02 tháng)', duration: '8 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Sản phụ khoa (01 tháng)', duration: '8 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Nhi (01 tháng)', duration: '8 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Hồi sức cấp cứu (03 tháng)', duration: '12 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Tai mũi họng (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Mắt (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Da liễu (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Tâm thần (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Xét nghiệm (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Chẩn đoán hình ảnh (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Y học cổ truyền – Phục hồi chức năng (02 tuần)', duration: '2 tuần' }
      ];
    } else if (specialty === 'Y sĩ') {
      rotations = [
        { name: 'Thực hành lâm sàng chuyên khoa Nội (01 tháng)', duration: '4 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Ngoại (01 tháng)', duration: '4 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Sản phụ khoa (01 tháng)', duration: '4 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Nhi (01 tháng)', duration: '4 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Hồi sức cấp cứu (03 tháng)', duration: '12 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Tai mũi họng (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Mắt (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Da liễu (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Tâm thần (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Xét nghiệm (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Chẩn đoán hình ảnh (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Y học cổ truyền – Phục hồi chức năng (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Răng hàm mặt (01 tuần)', duration: '1 tuần' }
      ];
    } else if (specialty === 'Y sĩ Y học cổ truyền') {
      rotations = [
        { name: 'Thực hành lâm sàng chuyên khoa Y học cổ truyền – Phục hồi chức năng (04 tháng)', duration: '16 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Hồi sức cấp cứu (03 tháng)', duration: '12 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Nội (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Ngoại (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Tai mũi họng (02 tuần)', duration: '2 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Mắt (01 tuần)', duration: '1 tuần' },
        { name: 'Thực hành lâm sàng chuyên khoa Răng hàm mặt (01 tuần)', duration: '1 tuần' }
      ];
    } else if (specialty === 'Dược sĩ') {
      rotations = [
        { name: 'Dược (24 tháng)', duration: '96 tuần' }
      ];
    } else if (specialty === 'Điều dưỡng đa khoa') {
      rotations = [
        { name: 'Thực hành chuyên khoa Nội – Nhi', duration: '3 tháng' },
        { name: 'Thực hành chuyên khoa Ngoại', duration: '2 tháng' },
        { name: 'Thực hành chuyên khoa Hồi sức cấp cứu', duration: '1 tháng' }
      ];
    } else if (specialty === 'Điều dưỡng chuyên ngành phụ sản') {
      rotations = [
        { name: 'Thực hành chuyên khoa Sản phụ khoa', duration: '5 tháng' },
        { name: 'Thực hành chuyên khoa Hồi sức cấp cứu', duration: '1 tháng' }
      ];
    } else if (specialty === 'Kỹ thuật viên Xét nghiệm') {
      rotations = [
        { name: 'Thực hành chuyên khoa Xét nghiệm', duration: '5 tháng' },
        { name: 'Thực hành chuyên khoa Hồi sức cấp cứu', duration: '1 tháng' }
      ];
    } else if (specialty === 'Kỹ thuật viên Hình ảnh Y học') {
      rotations = [
        { name: 'Thực hành chuyên khoa Hình ảnh Y học', duration: '5 tháng' },
        { name: 'Thực hành chuyên khoa Hồi sức cấp cứu', duration: '1 tháng' }
      ];
    } else if (specialty === 'Kỹ thuật viên Phục hồi chức năng') {
      rotations = [
        { name: 'Thực hành chuyên khoa Vật lý trị liệu – PHCN', duration: '5 tháng' },
        { name: 'Thực hành chuyên khoa Hồi sức cấp cứu', duration: '1 tháng' }
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

  for (let i = 0; i < rotations.length; i++) {
    const rot = rotations[i];
    await client.query(
      `INSERT INTO practitioner_rotations (practitioner_id, name, duration, status, order_index, supervisor_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        practitionerId,
        rot.name,
        rot.duration,
        i === 0 ? 'Đang thực hành' : 'Chờ xoay khoa',
        i,
        null
      ]
    );
  }

  await recalculateRotationDates(client, practitionerId);
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
      SELECT s.*, (
        SELECT COUNT(DISTINCT p.id)
        FROM practitioners p
        JOIN practitioner_rotations r ON p.id = r.practitioner_id
        WHERE p.status = 'Đang thực hành'
          AND r.supervisor_id = s.id
      ) as active_trainees
      FROM supervisors s
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

app.put('/api/supervisors/:id', async (req, res) => {
  const { id } = req.params;
  const { name, dob, gender, email, phone, license_number, specialty, license_date, department } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Find the supervisor and retrieve their user_id
    const sRes = await client.query('SELECT user_id FROM supervisors WHERE id = $1', [id]);
    if (sRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người hướng dẫn.' });
    }
    const userId = sRes.rows[0].user_id;

    // Update corresponding user record
    if (userId) {
      await client.query(
        `UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4`,
        [name, email && email.trim() !== '' ? email : null, phone && phone.trim() !== '' ? phone : null, userId]
      );
    }

    // Update supervisor record
    const result = await client.query(
      `UPDATE supervisors 
       SET name = $1, dob = $2, gender = $3, email = $4, phone = $5, license_number = $6, specialty = $7, license_date = $8, department = $9
       WHERE id = $10 RETURNING *`,
      [
        name,
        dob && dob.trim() !== '' ? dob : null,
        gender && gender.trim() !== '' ? gender : null,
        email && email.trim() !== '' ? email : null,
        phone && phone.trim() !== '' ? phone : null,
        license_number,
        specialty,
        license_date && license_date.trim() !== '' ? license_date : null,
        department && department.trim() !== '' ? department : null,
        id
      ]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating supervisor:", err);
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
      SELECT p.*,
             (
               SELECT s.name
               FROM practitioner_rotations r
               JOIN supervisors s ON r.supervisor_id = s.id
               WHERE r.practitioner_id = p.id AND r.status = 'Đang thực hành'
               LIMIT 1
             ) as supervisor_name,
             (
               SELECT COALESCE(ARRAY_AGG(r.supervisor_id), '{}')
               FROM practitioner_rotations r
               WHERE r.practitioner_id = p.id AND r.supervisor_id IS NOT NULL
             ) as rotation_supervisor_ids
      FROM practitioners p
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
      LEFT JOIN practitioner_rotations r ON p.id = r.practitioner_id AND r.status = 'Đang thực hành'
      LEFT JOIN supervisors s ON r.supervisor_id = s.id
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

    if (supervisor_id) {
      const activeCountRes = await client.query(`
        SELECT COUNT(DISTINCT p.id) as active_count
        FROM practitioners p
        LEFT JOIN practitioner_rotations r ON p.id = r.practitioner_id AND r.status = 'Đang thực hành'
        WHERE p.status = 'Đang thực hành'
          AND (p.supervisor_id = $1 OR r.supervisor_id = $1)
      `, [supervisor_id]);
      if (parseInt(activeCountRes.rows[0].active_count) >= 5) {
        return res.status(400).json({ error: 'Người hướng dẫn này đã vượt quá số lượng 5 học viên hướng dẫn cùng lúc.' });
      }
    }

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

app.post('/api/practitioners/bulk', async (req, res) => {
  const { practitioners } = req.body;
  if (!Array.isArray(practitioners)) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ. Phải cung cấp một danh sách học viên.' });
  }

  const client = await pool.connect();
  const results = [];
  const errors = [];

  try {
    for (let i = 0; i < practitioners.length; i++) {
      const p = practitioners[i];
      const { 
        name, dob, gender, email, phone, degree, specialty, 
        program, start_date, supervisor_id, username, password 
      } = p;

      if (!name || !specialty) {
        errors.push(`Dòng ${i + 1}: Thiếu Họ tên hoặc Chức danh đăng ký.`);
        continue;
      }

      try {
        await client.query('BEGIN');

        // Calculate next sequence number for bvlcXXXX
        const countRes = await client.query("SELECT COUNT(*) FROM users WHERE username LIKE 'bvlc%'");
        const nextNum = parseInt(countRes.rows[0].count) + 1;
        const xxxx = String(nextNum).padStart(4, '0');
        
        const removeVietnameseTones = (str) => {
          str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
          str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
          str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
          str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
          str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
          str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
          str = str.replace(/đ/g, "d");
          str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
          str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
          str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
          str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
          str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
          str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
          str = str.replace(/Đ/g, "D");
          str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
          str = str.replace(/\u02C6|\u0306|\u031B/g, "");
          return str;
        };
        
        const cleanName = removeVietnameseTones(name).toLowerCase().replace(/[^a-z0-9]/g, '');
        const uVal = `bvlc${xxxx}-${cleanName}`;

        // Insert user
        const uRes = await client.query(
          `INSERT INTO users (username, password, role, name, email, phone)
           VALUES ($1, $2, 'Học viên', $3, $4, $5) RETURNING id`,
          [uVal, password || '123456', name, email || null, phone || null]
        );
        const userId = uRes.rows[0].id;

        // Insert practitioner profile directly as "Đã duyệt"
        const result = await client.query(
          `INSERT INTO practitioners (
             user_id, name, dob, gender, email, phone, degree, specialty, 
             program, start_date, supervisor_id, status, profile_status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Đang thực hành', 'Đã duyệt') RETURNING *`,
          [
            userId, name, dob || new Date().toISOString().split('T')[0], 
            gender || 'Nam', email || null, phone || null, degree || 'Đại học', 
            specialty, program || 'ND96', start_date || new Date().toISOString().split('T')[0], 
            supervisor_id || null
          ]
        );

        // Seed default rotations
        await seedDefaultRotations(
          client, 
          result.rows[0].id, 
          program || 'ND96', 
          specialty, 
          start_date || new Date().toISOString().split('T')[0], 
          supervisor_id || null
        );

        await client.query('COMMIT');
        results.push(result.rows[0]);
        
        // Send welcome email in background
        sendWelcomeEmail(email, name, uVal, password || '123456').catch(err => {
          console.error('[Email Welcome Background Error]', err);
        });
      } catch (rowErr) {
        await client.query('ROLLBACK');
        errors.push(`Dòng ${i + 1}: Lỗi lưu CSDL (${rowErr.message})`);
      }
    }

    res.status(201).json({ 
      success: true, 
      imported_count: results.length,
      errors: errors 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/practitioners/:id', async (req, res) => {
  const { name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, status, profile_status, rejection_reason, avatar_url, degree_scan_url } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (supervisor_id && (status === 'Đang thực hành')) {
      const activeCountRes = await client.query(`
        SELECT COUNT(DISTINCT p.id) as active_count
        FROM practitioners p
        LEFT JOIN practitioner_rotations r ON p.id = r.practitioner_id AND r.status = 'Đang thực hành'
        WHERE p.status = 'Đang thực hành'
          AND (p.supervisor_id = $1 OR r.supervisor_id = $1)
          AND p.id <> $2
      `, [supervisor_id, req.params.id]);
      if (parseInt(activeCountRes.rows[0].active_count) >= 5) {
        return res.status(400).json({ error: 'Người hướng dẫn này đã vượt quá số lượng 5 học viên hướng dẫn cùng lúc.' });
      }
    }
    const result = await client.query(
      `UPDATE practitioners 
       SET name=$1, dob=$2, gender=$3, email=$4, phone=$5, degree=$6, specialty=$7, program=$8, start_date=$9, supervisor_id=$10, status=$11, profile_status=$12, rejection_reason=$13, avatar_url=COALESCE($14, avatar_url), degree_scan_url=COALESCE($15, degree_scan_url)
       WHERE id=$16 RETURNING *`,
      [name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, status, profile_status, rejection_reason, avatar_url, degree_scan_url, req.params.id]
    );
    await recalculateRotationDates(client, req.params.id);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// A.03: Approve or reject profile
app.post('/api/practitioners/:id/approve', async (req, res) => {
  const { status, reason } = req.body; // 'Đã duyệt' or 'Từ chối'
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const pracRes = await client.query('SELECT * FROM practitioners WHERE id = $1', [req.params.id]);
    if (pracRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Practitioner profile not found' });
    }
    const prac = pracRes.rows[0];

    let finalUsername = null;
    if (status === 'Đã duyệt') {
      // Calculate next sequence number for bvlcXXXX
      const countRes = await client.query("SELECT COUNT(*) FROM users WHERE username LIKE 'bvlc%'");
      const nextNum = parseInt(countRes.rows[0].count) + 1;
      const xxxx = String(nextNum).padStart(4, '0');
      
      const removeVietnameseTones = (str) => {
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
        str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
        str = str.replace(/đ/g, "d");
        str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
        str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
        str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
        str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
        str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
        str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
        str = str.replace(/Đ/g, "D");
        str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
        str = str.replace(/\u02C6|\u0306|\u031B/g, "");
        return str;
      };
      
      const cleanName = removeVietnameseTones(prac.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      finalUsername = `bvlc${xxxx}-${cleanName}`;
      
      // Update username and password in users table
      if (prac.user_id) {
        await client.query(
          "UPDATE users SET username = $1, password = '123456' WHERE id = $2",
          [finalUsername, prac.user_id]
        );
      }
    }

    const result = await client.query(
      'UPDATE practitioners SET profile_status = $1, rejection_reason = $2 WHERE id = $3 RETURNING *',
      [status, reason || null, req.params.id]
    );

    // Send notification to trainee
    if (prac.user_id) {
      const msg = status === 'Đã duyệt' 
        ? `Hồ sơ đăng ký thực hành của bạn tại TTYT Liên Chiểu đã được duyệt thành công. Tài khoản đăng nhập mới của bạn là: ${finalUsername}, mật khẩu: 123456.`
        : `Hồ sơ thực hành của bạn bị từ chối duyệt. Lý do: ${reason}`;
      await client.query('INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)', [prac.user_id, 'Kết quả duyệt hồ sơ', msg]);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// A.04: Assign supervisor
app.post('/api/practitioners/:id/assign-supervisor', async (req, res) => {
  const { supervisorId } = req.body;
  try {
    if (supervisorId) {
      const pQuery = await pool.query('SELECT status FROM practitioners WHERE id = $1', [req.params.id]);
      const pStatus = pQuery.rows.length > 0 ? pQuery.rows[0].status : '';
      if (pStatus === 'Đang thực hành') {
        const activeCountRes = await pool.query(`
          SELECT COUNT(DISTINCT p.id) as active_count
          FROM practitioners p
          LEFT JOIN practitioner_rotations r ON p.id = r.practitioner_id AND r.status = 'Đang thực hành'
          WHERE p.status = 'Đang thực hành'
            AND (p.supervisor_id = $1 OR r.supervisor_id = $1)
            AND p.id <> $2
        `, [supervisorId, req.params.id]);
        if (parseInt(activeCountRes.rows[0].active_count) >= 5) {
          return res.status(400).json({ error: 'Người hướng dẫn này đã vượt quá số lượng 5 học viên hướng dẫn cùng lúc.' });
        }
      }
    }
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
  const { name, duration, status, supervisor_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const maxRes = await client.query('SELECT COALESCE(MAX(order_index), -1) as max_idx FROM practitioner_rotations WHERE practitioner_id = $1', [req.params.id]);
    const nextIdx = maxRes.rows[0].max_idx + 1;

    const result = await client.query(
      `INSERT INTO practitioner_rotations (practitioner_id, name, duration, status, order_index, supervisor_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, name, duration, status || 'Chờ xoay khoa', nextIdx, supervisor_id || null]
    );
    await recalculateRotationDates(client, req.params.id);
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update a rotation stage
app.put('/api/rotations/:id', async (req, res) => {
  const { name, duration, status, supervisor_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rRes = await client.query('SELECT practitioner_id FROM practitioner_rotations WHERE id = $1', [req.params.id]);
    if (rRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Rotation not found' });
    }
    const practitionerId = rRes.rows[0].practitioner_id;

    if (supervisor_id && (status === 'Đang thực hành')) {
      const activeCountRes = await client.query(`
        SELECT COUNT(DISTINCT p.id) as active_count
        FROM practitioners p
        LEFT JOIN practitioner_rotations r ON p.id = r.practitioner_id AND r.status = 'Đang thực hành'
        WHERE p.status = 'Đang thực hành'
          AND (p.supervisor_id = $1 OR r.supervisor_id = $1)
          AND p.id <> $2
      `, [supervisor_id, practitionerId]);
      if (parseInt(activeCountRes.rows[0].active_count) >= 5) {
        return res.status(400).json({ error: 'Người hướng dẫn này đã vượt quá số lượng 5 học viên hướng dẫn cùng lúc.' });
      }
    }

    const result = await client.query(
      `UPDATE practitioner_rotations
       SET name=$1, duration=$2, status=$3, supervisor_id=$4
       WHERE id=$5 RETURNING *`,
      [name, duration, status || 'Chờ xoay khoa', supervisor_id || null, req.params.id]
    );
    await recalculateRotationDates(client, practitionerId);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete a rotation stage
app.delete('/api/rotations/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rRes = await client.query('SELECT practitioner_id FROM practitioner_rotations WHERE id = $1', [req.params.id]);
    if (rRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Rotation not found' });
    }
    const practitionerId = rRes.rows[0].practitioner_id;

    await client.query('DELETE FROM practitioner_rotations WHERE id = $1', [req.params.id]);
    await recalculateRotationDates(client, practitionerId);
    await client.query('COMMIT');
    res.json({ message: 'Rotation stage deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Reorder rotations
app.post('/api/rotations/reorder', async (req, res) => {
  const { rotationIds } = req.body;
  if (!rotationIds || !Array.isArray(rotationIds) || rotationIds.length === 0) {
    return res.status(400).json({ error: 'Danh sách ID không hợp lệ' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rRes = await client.query('SELECT practitioner_id FROM practitioner_rotations WHERE id = $1', [rotationIds[0]]);
    if (rRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Rotation not found' });
    }
    const practitionerId = rRes.rows[0].practitioner_id;

    for (let i = 0; i < rotationIds.length; i++) {
      await client.query(
        'UPDATE practitioner_rotations SET order_index = $1 WHERE id = $2 AND practitioner_id = $3',
        [i, rotationIds[i], practitionerId]
      );
    }
    await recalculateRotationDates(client, practitionerId);
    await client.query('COMMIT');
    res.json({ message: 'Sắp xếp thứ tự xoay khoa thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
  const { 
    practitioner_id, 
    department, 
    evaluation_type, 
    rating_specialty, 
    rating_ethics, 
    rating_law, 
    rating_communication, 
    rating_safety, 
    result, 
    comment, 
    evaluator_id,
    rating_knowledge,
    rating_skills,
    rating_experience,
    rating_growth,
    rating_attitude,
    rating_discipline,
    by_manager
  } = req.body;
  try {
    // 1. Enforce assigned stage supervisor check (skip if created by a manager)
    if (!by_manager) {
      if (department !== 'Đánh giá chung') {
        const rotCheck = await pool.query(
          'SELECT supervisor_id FROM practitioner_rotations WHERE practitioner_id = $1 AND name = $2',
          [practitioner_id, department]
        );
        if (rotCheck.rows.length > 0) {
          const assignedSupervisorId = rotCheck.rows[0].supervisor_id;
          if (!assignedSupervisorId) {
            return res.status(400).json({
              error: `Giai đoạn thực hành '${department}' chưa được phân công người hướng dẫn.`
            });
          }
          if (assignedSupervisorId !== evaluator_id) {
            return res.status(400).json({
              error: `Bạn không phải là người hướng dẫn được phân công cho giai đoạn '${department}'.`
            });
          }
        }
      } else {
        // For "Đánh giá chung", evaluator must be assigned to at least one stage of this practitioner
        const rotCheckAny = await pool.query(
          'SELECT COUNT(*) as count FROM practitioner_rotations WHERE practitioner_id = $1 AND supervisor_id = $2',
          [practitioner_id, evaluator_id]
        );
        if (parseInt(rotCheckAny.rows[0].count) === 0) {
          return res.status(400).json({
            error: `Bạn phải là người hướng dẫn của ít nhất một giai đoạn thực hành để thực hiện đánh giá chung.`
          });
        }
      }
    }

    // Validate evaluator specialty matches the department specialty if not "Đánh giá chung"
    if (department !== 'Đánh giá chung' && evaluator_id) {
      const supQuery = await pool.query('SELECT specialty, name FROM supervisors WHERE id = $1', [evaluator_id]);
      if (supQuery.rows.length > 0) {
        const supervisorSpecialty = supQuery.rows[0].specialty.toLowerCase();
        const supervisorName = supQuery.rows[0].name;
        const deptLower = department.toLowerCase();
        
        // Define specialty match keywords
        const keywords = [
          { key: 'nội', match: ['nội'] },
          { key: 'ngoại', match: ['ngoại'] },
          { key: 'sản', match: ['sản', 'phụ sản'] },
          { key: 'nhi', match: ['nhi'] },
          { key: 'tai mũi họng', match: ['tai mũi họng'] },
          { key: 'răng hàm mặt', match: ['răng hàm mặt', 'rhm'] },
          { key: 'mắt', match: ['mắt'] },
          { key: 'y học cổ truyền', match: ['y học cổ truyền', 'yhct'] },
          { key: 'da liễu', match: ['da liễu'] },
          { key: 'hồi sức', match: ['hồi sức', 'cấp cứu'] },
          { key: 'xét nghiệm', match: ['xét nghiệm'] },
          { key: 'hình ảnh', match: ['hình ảnh'] },
          { key: 'phục hồi', match: ['phục hồi', 'vật lý trị liệu', 'phcn'] },
          { key: 'dược', match: ['dược', 'dược sĩ'] }
        ];

        const matchedKeyword = keywords.find(kw => kw.match.some(m => deptLower.includes(m)));
        if (matchedKeyword) {
          let isMatch = matchedKeyword.match.some(m => supervisorSpecialty.includes(m));
          
          // Nurse, midwife, and technician supervisors are allowed to evaluate clinical stages for nurse/midwife/tech trainees
          if (supervisorSpecialty.includes('điều dưỡng') || supervisorSpecialty.includes('hộ sinh') || supervisorSpecialty.includes('kỹ thuật')) {
            const pracQuery = await pool.query('SELECT specialty FROM practitioners WHERE id = $1', [practitioner_id]);
            if (pracQuery.rows.length > 0) {
              const pracSpecialty = pracQuery.rows[0].specialty.toLowerCase();
              if (pracSpecialty.includes('điều dưỡng') || pracSpecialty.includes('hộ sinh') || pracSpecialty.includes('kỹ thuật')) {
                isMatch = true;
              }
            }
          }
          
          if (!isMatch) {
            return res.status(400).json({ 
              error: `Bác sĩ/Điều dưỡng ${supervisorName} chuyên khoa '${supQuery.rows[0].specialty}' không được phép đánh giá chuyên khoa '${department}'.` 
            });
          }
        }
      }
    }

    // Delete existing evaluation of same type + department
    await pool.query('DELETE FROM evaluations WHERE practitioner_id=$1 AND department=$2 AND evaluation_type=$3', [practitioner_id, department, evaluation_type || 'Định kỳ']);
    
    const resEval = await pool.query(
      `INSERT INTO evaluations (
         practitioner_id, department, evaluation_type, 
         rating_specialty, rating_ethics, rating_law, rating_communication, rating_safety, 
         result, comment, evaluator_id,
         rating_knowledge, rating_skills, rating_experience, rating_growth, rating_attitude, rating_discipline
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [
        practitioner_id, 
        department, 
        evaluation_type || 'Định kỳ', 
        rating_specialty, 
        rating_ethics, 
        rating_law, 
        rating_communication, 
        rating_safety, 
        result, 
        comment, 
        evaluator_id,
        rating_knowledge,
        rating_skills,
        rating_experience,
        rating_growth,
        rating_attitude,
        rating_discipline
      ]
    );
    res.status(201).json(resEval.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an evaluation
app.put('/api/evaluations/:id', async (req, res) => {
  const { 
    department, 
    evaluation_type, 
    rating_specialty, 
    rating_ethics, 
    rating_law, 
    rating_communication, 
    rating_safety, 
    result, 
    comment, 
    evaluator_id,
    rating_knowledge,
    rating_skills,
    rating_experience,
    rating_growth,
    rating_attitude,
    rating_discipline,
    by_manager
  } = req.body;
  try {
    // 1. Get current evaluation
    const currRes = await pool.query('SELECT * FROM evaluations WHERE id = $1', [req.params.id]);
    if (currRes.rows.length === 0) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }
    const currEval = currRes.rows[0];

    // 2. Validate matching supervisor as requested (skip if edited by a manager)
    if (!by_manager) {
      if (department !== 'Đánh giá chung' && evaluator_id) {
        const rotCheck = await pool.query(
          'SELECT supervisor_id FROM practitioner_rotations WHERE practitioner_id = $1 AND name = $2',
          [currEval.practitioner_id, department]
        );
        if (rotCheck.rows.length > 0) {
          const assignedSupervisorId = rotCheck.rows[0].supervisor_id;
          if (!assignedSupervisorId) {
            return res.status(400).json({
              error: `Giai đoạn thực hành '${department}' chưa được phân công người hướng dẫn.`
            });
          }
          if (assignedSupervisorId !== evaluator_id) {
            return res.status(400).json({
              error: `Bạn không phải là người hướng dẫn được phân công cho giai đoạn '${department}'.`
            });
          }
        }
      } else if (evaluator_id) {
        // For "Đánh giá chung", evaluator must be assigned to at least one stage of this practitioner
        const rotCheckAny = await pool.query(
          'SELECT COUNT(*) as count FROM practitioner_rotations WHERE practitioner_id = $1 AND supervisor_id = $2',
          [currEval.practitioner_id, evaluator_id]
        );
        if (parseInt(rotCheckAny.rows[0].count) === 0) {
          return res.status(400).json({
            error: `Bạn phải là người hướng dẫn của ít nhất một giai đoạn thực hành để thực hiện đánh giá chung.`
          });
        }
      }
    }

    const resultUpdate = await pool.query(
      `UPDATE evaluations
       SET department=$1, evaluation_type=$2, rating_specialty=$3, rating_ethics=$4, rating_law=$5, rating_communication=$6, rating_safety=$7,
           result=$8, comment=$9, evaluator_id=$10, rating_knowledge=$11, rating_skills=$12, rating_experience=$13, rating_growth=$14,
           rating_attitude=$15, rating_discipline=$16, evaluation_date=CURRENT_DATE
       WHERE id=$17 RETURNING *`,
      [
        department,
        evaluation_type || 'Định kỳ',
        rating_specialty,
        rating_ethics,
        rating_law,
        rating_communication,
        rating_safety,
        result,
        comment,
        evaluator_id,
        rating_knowledge,
        rating_skills,
        rating_experience,
        rating_growth,
        rating_attitude,
        rating_discipline,
        req.params.id
      ]
    );

    res.json(resultUpdate.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an evaluation
app.delete('/api/evaluations/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM evaluations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }
    res.json({ message: 'Evaluation deleted successfully' });
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
// API: SYSTEM BACKUP & RESTORE (Neon DB, File, & JSON Import/Export)
// ==========================================
let backupStore = null;

async function getBackupData(client) {
  const sups = await client.query('SELECT * FROM supervisors');
  const pracs = await client.query('SELECT * FROM practitioners');
  const logs = await client.query('SELECT * FROM practice_logs');
  const evals = await client.query('SELECT * FROM evaluations');
  const trains = await client.query('SELECT * FROM supplemental_training');
  const rots = await client.query('SELECT * FROM practitioner_rotations');
  const users = await client.query('SELECT * FROM users');
  const depts = await client.query('SELECT * FROM departments');
  const notifs = await client.query('SELECT * FROM notifications');

  return {
    timestamp: new Date(),
    users: users.rows,
    supervisors: sups.rows,
    practitioners: pracs.rows,
    logs: logs.rows,
    evaluations: evals.rows,
    training: trains.rows,
    rotations: rots.rows,
    departments: depts.rows,
    notifications: notifs.rows
  };
}

async function performRestore(client, backup) {
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
  if (backup.users) {
    for (const u of backup.users) {
      await client.query(
        'INSERT INTO users (id, username, password, role, name, email, phone, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [u.id, u.username, u.password, u.role, u.name, u.email, u.phone, u.created_at]
      );
    }
  }

  // Restore Supervisors
  if (backup.supervisors) {
    for (const s of backup.supervisors) {
      await client.query(
        'INSERT INTO supervisors (id, user_id, name, dob, gender, email, phone, license_number, specialty, license_date, department, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [s.id, s.user_id, s.name, s.dob, s.gender, s.email, s.phone, s.license_number, s.specialty, s.license_date, s.department, s.created_at]
      );
    }
  }

  // Restore Departments
  if (backup.departments) {
    for (const d of backup.departments) {
      await client.query(
        'INSERT INTO departments (id, name, created_at) VALUES ($1, $2, $3)',
        [d.id, d.name, d.created_at]
      );
    }
  }

  // Restore Practitioners
  if (backup.practitioners) {
    for (const p of backup.practitioners) {
      await client.query(
        `INSERT INTO practitioners (id, user_id, name, dob, gender, email, phone, degree, specialty, program, start_date, supervisor_id, status, profile_status, rejection_reason, avatar_url, degree_scan_url, national_test_score, national_test_result, national_test_date, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [p.id, p.user_id, p.name, p.dob, p.gender, p.email, p.phone, p.degree, p.specialty, p.program, p.start_date, p.supervisor_id, p.status, p.profile_status, p.rejection_reason, p.avatar_url, p.degree_scan_url, p.national_test_score, p.national_test_result, p.national_test_date, p.created_at]
      );
    }
  }

  // Restore Rotations
  if (backup.rotations) {
    for (const r of backup.rotations) {
      await client.query(
        'INSERT INTO practitioner_rotations (id, practitioner_id, name, duration, start_date, end_date, status, order_index, supervisor_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [r.id, r.practitioner_id, r.name, r.duration, r.start_date, r.end_date, r.status, r.order_index, r.supervisor_id, r.created_at]
      );
    }
  }

  // Restore Logs
  if (backup.logs) {
    for (const l of backup.logs) {
      await client.query(
        'INSERT INTO practice_logs (id, practitioner_id, log_date, department, content, procedures, quantity, status, supervisor_comment, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [l.id, l.practitioner_id, l.log_date, l.department, l.content, l.procedures, l.quantity, l.status, l.supervisor_comment, l.created_at]
      );
    }
  }

  // Restore Evaluations
  if (backup.evaluations) {
    for (const e of backup.evaluations) {
      await client.query(
        'INSERT INTO evaluations (id, practitioner_id, department, evaluation_type, rating_specialty, rating_ethics, rating_law, rating_communication, rating_safety, result, comment, evaluator_id, evaluation_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
        [e.id, e.practitioner_id, e.department, e.evaluation_type, e.rating_specialty, e.rating_ethics, e.rating_law, e.rating_communication, e.rating_safety, e.result, e.comment, e.evaluator_id, e.evaluation_date, e.created_at]
      );
    }
  }

  // Restore Training
  if (backup.training) {
    for (const t of backup.training) {
      await client.query(
        'INSERT INTO supplemental_training (id, practitioner_id, session_date, topic, hours, speaker, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [t.id, t.practitioner_id, t.session_date, t.topic, t.hours, t.speaker, t.created_at]
      );
    }
  }

  // Restore Notifications (if available)
  if (backup.notifications) {
    for (const n of backup.notifications) {
      await client.query(
        'INSERT INTO notifications (id, user_id, title, message, is_read, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [n.id, n.user_id, n.title, n.message, n.is_read, n.created_at]
      );
    }
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
  await client.query("SELECT setval(pg_get_serial_sequence('notifications', 'id'), COALESCE(MAX(id), 1)) FROM notifications;");
}

app.post('/api/system/backup', async (req, res) => {
  const client = await pool.connect();
  try {
    const backupData = await getBackupData(client);
    backupStore = backupData; // Sync RAM backup

    const summary = {
      users: backupData.users.length,
      supervisors: backupData.supervisors.length,
      practitioners: backupData.practitioners.length,
      logs: backupData.logs.length,
      evaluations: backupData.evaluations.length,
      training: backupData.training.length,
      rotations: backupData.rotations.length,
      departments: backupData.departments.length,
      notifications: backupData.notifications.length
    };

    // Save to Neon Database system_backups
    await client.query(
      'INSERT INTO system_backups (backup_data, summary) VALUES ($1, $2)',
      [JSON.stringify(backupData), JSON.stringify(summary)]
    );

    // Save to server local file (secondary fallback)
    try {
      fs.writeFileSync(path.join(__dirname, 'database_backup.json'), JSON.stringify(backupData, null, 2), 'utf8');
    } catch (fsErr) {
      console.error('Error writing database_backup.json:', fsErr);
    }

    res.json({
      message: 'Hệ thống đã được sao lưu thành công và đồng bộ lên Neon Cloud!',
      timestamp: backupData.timestamp,
      summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/system/restore', async (req, res) => {
  const client = await pool.connect();
  try {
    let restoreData = null;

    // 1. Try fetching from Neon Database system_backups
    try {
      const dbBackupRes = await client.query('SELECT backup_data FROM system_backups ORDER BY timestamp DESC LIMIT 1');
      if (dbBackupRes.rows.length > 0) {
        restoreData = dbBackupRes.rows[0].backup_data;
        console.log('Restoring from latest Neon Database backup...');
      }
    } catch (dbErr) {
      console.error('Error fetching backup from Neon DB:', dbErr);
    }

    // 2. Try fetching from local file backup
    if (!restoreData) {
      const localBackupPath = path.join(__dirname, 'database_backup.json');
      if (fs.existsSync(localBackupPath)) {
        try {
          restoreData = JSON.parse(fs.readFileSync(localBackupPath, 'utf8'));
          console.log('Restoring from local file backup fallback...');
        } catch (fsErr) {
          console.error('Error reading local file backup:', fsErr);
        }
      }
    }

    // 3. Fallback to RAM memory backup
    if (!restoreData) {
      restoreData = backupStore;
      if (restoreData) {
        console.log('Restoring from RAM memory backup fallback...');
      }
    }

    if (!restoreData) {
      return res.status(400).json({ error: 'Không tìm thấy bản sao lưu nào trên Neon DB, đĩa local, hoặc bộ nhớ RAM.' });
    }

    await client.query('BEGIN');
    await performRestore(client, restoreData);
    await client.query('COMMIT');

    res.json({ message: 'Hệ thống đã phục hồi dữ liệu từ bản sao lưu thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/system/export', async (req, res) => {
  const client = await pool.connect();
  try {
    const backupData = await getBackupData(client);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=qlhn_backup_${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/system/import', async (req, res) => {
  const backupData = req.body;
  if (!backupData || !backupData.users || !backupData.supervisors) {
    return res.status(400).json({ error: 'Dữ liệu tải lên không hợp lệ hoặc thiếu thông tin cốt lõi (users, supervisors).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await performRestore(client, backupData);
    await client.query('COMMIT');

    // Sync memory and local file backup
    backupStore = backupData;
    try {
      fs.writeFileSync(path.join(__dirname, 'database_backup.json'), JSON.stringify(backupData, null, 2), 'utf8');
    } catch (fsErr) {
      console.error('Error writing local backup file during import:', fsErr);
    }

    res.json({ message: 'Đã nhập tệp sao lưu và phục hồi dữ liệu thành công lên Neon!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/system/reset-practitioners', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Clear all related tables
    await client.query('DELETE FROM notifications;');
    await client.query('DELETE FROM supplemental_training;');
    await client.query('DELETE FROM evaluations;');
    await client.query('DELETE FROM practice_logs;');
    await client.query('DELETE FROM practitioner_rotations;');
    await client.query('DELETE FROM practitioners;');
    
    // Clear trainee user accounts
    await client.query("DELETE FROM users WHERE role = 'Học viên';");

    // Reset sequences for cleared tables
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;");
    await client.query("SELECT setval(pg_get_serial_sequence('practitioners', 'id'), COALESCE(MAX(id), 1)) FROM practitioners;");
    await client.query("SELECT setval(pg_get_serial_sequence('practitioner_rotations', 'id'), COALESCE(MAX(id), 1)) FROM practitioner_rotations;");
    await client.query("SELECT setval(pg_get_serial_sequence('practice_logs', 'id'), COALESCE(MAX(id), 1)) FROM practice_logs;");
    await client.query("SELECT setval(pg_get_serial_sequence('evaluations', 'id'), COALESCE(MAX(id), 1)) FROM evaluations;");
    await client.query("SELECT setval(pg_get_serial_sequence('supplemental_training', 'id'), COALESCE(MAX(id), 1)) FROM supplemental_training;");
    await client.query("SELECT setval(pg_get_serial_sequence('notifications', 'id'), COALESCE(MAX(id), 1)) FROM notifications;");

    await client.query('COMMIT');
    res.json({ message: 'Đã xóa toàn bộ học viên và thông báo hệ thống thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// A.06: Confirm completion of a rotation stage
app.post('/api/rotations/:id/complete', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get current rotation details
    const rRes = await client.query('SELECT * FROM practitioner_rotations WHERE id = $1', [req.params.id]);
    if (rRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Rotation stage not found' });
    }
    const currentRot = rRes.rows[0];
    
    // Update current rotation status to completed
    await client.query(
      "UPDATE practitioner_rotations SET status = 'Đã hoàn thành' WHERE id = $1",
      [req.params.id]
    );

    // Find the next rotation stage (next order_index)
    const nextRotRes = await client.query(
      `SELECT * FROM practitioner_rotations 
       WHERE practitioner_id = $1 AND order_index > $2 
       ORDER BY order_index ASC LIMIT 1`,
      [currentRot.practitioner_id, currentRot.order_index]
    );

    if (nextRotRes.rows.length > 0) {
      const nextRot = nextRotRes.rows[0];
      // Update next rotation status to 'Đang thực hành'
      await client.query(
        "UPDATE practitioner_rotations SET status = 'Đang thực hành' WHERE id = $1",
        [nextRot.id]
      );
    } else {
      // If final stage, mark practitioner overall status as completed
      await client.query(
        "UPDATE practitioners SET status = 'Hoàn thành' WHERE id = $1",
        [currentRot.practitioner_id]
      );
    }

    await recalculateRotationDates(client, currentRot.practitioner_id);
    await client.query('COMMIT');
    res.json({ message: 'Rotation stage completed successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// A.05: Download Excel Template with Data Validations (dropdowns)
app.get('/api/templates/excel', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('DanhSachHocVien');
    const refSheet = workbook.addWorksheet('DanhMucChucDanh');

    // Hide refSheet so the user doesn't see a messy metadata sheet
    refSheet.state = 'hidden';

    // Populate refSheet options
    refSheet.getCell('A1').value = 'Chức danh đăng ký';
    const specialties = [
      "Bác sĩ",
      "Bác sĩ Răng hàm mặt",
      "Bác sĩ Y học cổ truyền",
      "Bác sĩ Y học dự phòng",
      "Y sĩ",
      "Y sĩ Y học cổ truyền",
      "Dược sĩ",
      "Điều dưỡng đa khoa",
      "Điều dưỡng chuyên ngành phụ sản",
      "Kỹ thuật viên Xét nghiệm",
      "Kỹ thuật viên Hình ảnh Y học",
      "Kỹ thuật viên Phục hồi chức năng",
      "Hộ sinh",
      "Điều dưỡng",
      "Kỹ thuật y",
      "Cấp cứu viên ngoại viện",
      "Tâm lý lâm sàng"
    ];
    specialties.forEach((s, idx) => {
      refSheet.getCell(`A${idx + 2}`).value = s;
    });

    // Populate columns on worksheet
    worksheet.columns = [
      { header: 'Họ và tên', key: 'name', width: 25 },
      { header: 'Ngày sinh (DD-MM-YYYY)', key: 'dob', width: 22 },
      { header: 'Giới tính', key: 'gender', width: 12 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Số điện thoại', key: 'phone', width: 18 },
      { header: 'Văn bằng chuyên môn', key: 'degree', width: 22 },
      { header: 'Chức danh đăng ký', key: 'specialty', width: 28 },
      { header: 'Khung thực hành (ND96/TT21)', key: 'program', width: 28 },
      { header: 'Ngày bắt đầu (DD-MM-YYYY)', key: 'start_date', width: 22 }
    ];

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add demo rows
    worksheet.addRow(["Nguyễn Văn An", "15-05-1998", "Nam", "vanan@lienchieu.gov.vn", "0912345678", "Bác sĩ y khoa", "Bác sĩ", "ND96", "01-08-2026"]);
    worksheet.addRow(["Trần Thị Bình", "20-02-2000", "Nữ", "thibinh@lienchieu.gov.vn", "0987654321", "Cử nhân điều dưỡng", "Điều dưỡng đa khoa", "ND96", "01-08-2026"]);

    // Apply validations G2:G100, C2:C100, H2:H100
    for (let i = 2; i <= 100; i++) {
      // Column G (Chức danh đăng ký) from list in refSheet
      worksheet.getCell(`G${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['DanhMucChucDanh!$A$2:$A$18']
      };

      // Column C (Giới tính)
      worksheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Nam,Nữ"']
      };

      // Column H (Khung thực hành)
      worksheet.getCell(`H${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"ND96,TT21"']
      };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=mau_danh_sach_hoc_vien.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
