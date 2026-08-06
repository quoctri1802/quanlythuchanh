# Hướng dẫn Sử dụng Hệ thống Quản lý Thực hành Y khoa

Chào mừng bạn đến với **Hệ thống Quản lý Thực hành Y khoa** cấp Giấy phép hành nghề. Hệ thống được thiết kế để chuẩn hóa và số hóa toàn bộ quy trình luân khoa, thực hành lâm sàng, nhật ký thực hành, đánh giá năng lực & y đức theo Nghị định 96/2023/NĐ-CP và Thông tư 21/2020/TT-BYT.

Hệ thống phân chia thành 3 vai trò tài khoản chính với các chức năng chuyên biệt:
1. **Cán bộ quản lý (Manager)**: Quản lý tổng thể học viên, phân công người hướng dẫn, tiếp nhận hồ sơ, lập đánh giá tổng kết cuối khóa và in ấn chứng nhận.
2. **Người hướng dẫn (Supervisor)**: Theo dõi học viên được phân công, kiểm tra nhật ký thực hành và đánh giá năng lực các giai đoạn luân khoa.
3. **Học viên thực hành (Trainee)**: Xem lộ trình xoay khoa, cập nhật nhật ký thực hành lâm sàng hằng ngày, và theo dõi tiến độ đào tạo.

---

## Phần 1: Dành cho Cán bộ quản lý (Manager)

Cán bộ quản lý có toàn quyền quản trị và thực hiện các công tác đào tạo của bệnh viện.

![Giao diện Dashboard của Cán bộ quản lý](C:/Users/Admin/.gemini/antigravity/brain/67587e59-2334-4427-a170-9065fad57581/dashboard_manager_1785920761310.jpg)

### 1.1 Tiếp nhận & Import Học viên bằng File Excel
* **Bước 1**: Nhấp vào nút **"Nhập Excel/CSV"** tại góc phải màn hình Quản lý học viên.
* **Bước 2**: Tải lên danh sách học viên theo file mẫu.
* **Bước 3**: Sau khi Import thành công:
  * Hệ thống tự động tạo tài khoản đăng nhập (`username` và `password` mặc định `123456`).
  * Hệ thống tự động gửi **Email thông báo tài khoản** về mail cá nhân của học viên qua dịch vụ SMTP được cấu hình.
  * Hệ thống tự động khởi tạo **Lộ trình luân khoa mặc định** (12 tháng hoặc 18 tháng tùy theo chuyên ngành).

### 1.2 Phân công Người hướng dẫn Giai đoạn
* Hệ thống quản lý theo cơ chế **Người hướng dẫn theo giai đoạn xoay khoa**.
* **Cách thực hiện**: Vào Chi tiết học viên -> Chọn tab **"Lộ trình xoay khoa"** -> Click **"Đổi BS hướng dẫn"** tại từng giai đoạn cụ thể để chỉ định người hướng dẫn tương ứng cho giai đoạn đó.

### 1.3 Lập Đánh giá Tổng kết Cuối khóa (Đạt năng lực & Y đức)
* Cán bộ quản lý có quyền thay mặt hội đồng lập đánh giá tổng kết cuối khóa:
  * Truy cập tab **"Đánh giá"** của học viên -> Nhấp **"Thêm đánh giá"**.
  * Chọn khoa **"Đánh giá chung"** và loại **"Cuối khóa"**.
  * Chọn bác sĩ ký phiếu đánh giá tại mục **"Người hướng dẫn"** (Hệ thống gợi ý các bác sĩ trực tiếp hướng dẫn ở các giai đoạn).
  * Điền điểm năng lực, nhận xét và chọn kết quả **"Đạt"**. Nhấp **"Lưu đánh giá"**.

### 1.4 In Giấy xác nhận (Mẫu 07) & Xuất ZIP Hồ sơ
* **In Giấy xác nhận**: Nhấp nút **"In Giấy xác nhận (Mẫu 07)"**. Hệ thống tự động điền danh sách **tất cả người hướng dẫn** đã đồng hành ở các giai đoạn luân khoa, và ký tên dưới danh nghĩa Giám đốc **Bs.CKII. NGUYỄN THÀNH TÂN**.
* **Xuất ZIP**: Nhấp nút **"Xuất ZIP Hồ sơ"** để tải toàn bộ chứng từ (Giấy xác nhận Mẫu 07, Đơn đề nghị Mẫu 08) về máy tính để nộp Sở Y tế.

---

## Phần 2: Dành cho Người hướng dẫn (Supervisor)

Bác sĩ hướng dẫn theo dõi sát sao tiến độ và ký duyệt năng lực cho học viên.

![Giao diện Dashboard của Người hướng dẫn](C:/Users/Admin/.gemini/antigravity/brain/67587e59-2334-4427-a170-9065fad57581/dashboard_supervisor_1785920774569.jpg)

### 2.1 Xem Học viên phụ trách tức thời
* Ngay sau khi Cán bộ quản lý phân công bác sĩ hướng dẫn cho học viên ở bất kỳ giai đoạn luân khoa nào (kể cả các giai đoạn trong tương lai), học viên đó sẽ lập tức xuất hiện trên Dashboard của bác sĩ.
* Bác sĩ không cần chờ đến khi học viên luân chuyển tới khoa mình mới nhìn thấy hồ sơ của họ.

### 2.2 Ký duyệt Nhật ký Thực hành lâm sàng
* Học viên cập nhật hoạt động lâm sàng hàng ngày tại tab **"Nhật ký"**.
* Bác sĩ phụ trách giai đoạn đó truy cập danh sách, kiểm tra nội dung và click **"Duyệt nhật ký"** để xác nhận giờ thực hành hợp lệ cho học viên.

### 2.3 Lập Đánh giá Giai đoạn / Định kỳ
* Khi kết thúc giai đoạn xoay khoa tại khoa của mình:
  * Bác sĩ nhấp nút **"Thêm đánh giá"** tại tab **"Đánh giá"**.
  * Chọn khoa đang phụ trách và nhập nhận xét chuyên môn, thái độ làm việc, tuân thủ pháp luật và y đức của học viên.
  * Đánh giá này sẽ là cơ sở quan trọng để Cán bộ quản lý tổng hợp lập Giấy xác nhận cuối khóa.

---

## Phần 3: Dành cho Học viên (Trainee)

Học viên chủ động thực hiện lộ trình thực hành và ghi nhận nhật ký hàng ngày.

![Giao diện Dashboard của Học viên](C:/Users/Admin/.gemini/antigravity/brain/67587e59-2334-4427-a170-9065fad57581/dashboard_trainee_1785920790440.jpg)

### 3.1 Đăng nhập & Đổi mật khẩu
* Học viên nhận email thông báo chứa tên đăng nhập (`bvlcXXXX-[ten]`) và mật khẩu mặc định (`123456`) ngay khi được tiếp nhận.
* Nhấp vào tên tài khoản ở góc trên bên phải màn hình -> Chọn **"Đổi mật khẩu"** để đảm bảo bảo mật thông tin cá nhân.

### 3.2 Ghi nhận Nhật ký Thực hành Lâm sàng
* Hàng ngày sau ca trực hoặc buổi lâm sàng, học viên vào tab **"Nhật ký thực hành"** -> Nhấp **"Thêm nhật ký mới"**.
* Chọn giai đoạn xoay khoa hiện tại, điền chi tiết công việc chuyên môn (ví dụ: phụ mổ, thăm khám bệnh nhân, lập bệnh án...) và số giờ thực hành lâm sàng.
* Theo dõi trạng thái duyệt của Bác sĩ hướng dẫn trực tiếp.

### 3.3 Theo dõi Checklist Hoàn thành Thực hành
* Học viên có thể xem điều kiện hoàn thành khóa thực hành hiển thị trực tiếp ở phần tiến độ.
* Mục **Đào tạo bổ trợ - Học lý thuyết** hiển thị dưới dạng **Không bắt buộc (Tùy chọn)**. Học viên có thể tham gia các buổi lý thuyết để bổ trợ kiến thức (đạt tích xanh) nhưng nếu chưa hoàn thành cũng sẽ không bị chặn việc cấp Giấy xác nhận Mẫu 07 sau khi hoàn thành thời gian lâm sàng.
