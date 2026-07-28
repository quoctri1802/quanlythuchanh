// Template generator for official practice certificates in Vietnam
const Templates = {
  // Mẫu 07 Phụ lục I Nghị định 96/2023/NĐ-CP
  generateDecree96Certificate(practitioner, supervisor, evaluations, trainingSessions) {
    const today = new Date();
    const formattedToday = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
    const dob = new Date(practitioner.dob).toLocaleDateString('vi-VN');
    const startDate = new Date(practitioner.start_date).toLocaleDateString('vi-VN');
    
    // Calculate end date based on specialty duration:
    // Bác sĩ: 12 months, Y sĩ: 9 months, Điều dưỡng/Hộ sinh/Kỹ thuật y: 6 months
    let durationMonths = 6;
    if (practitioner.specialty === 'Bác sĩ') durationMonths = 12;
    else if (practitioner.specialty === 'Y sĩ' || practitioner.specialty === 'Tâm lý lâm sàng') durationMonths = 9;
    
    const endDateObj = new Date(practitioner.start_date);
    endDateObj.setMonth(endDateObj.getMonth() + durationMonths);
    const endDate = endDateObj.toLocaleDateString('vi-VN');

    // Get final evaluation comment
    const generalEval = evaluations.find(e => e.department === 'Đánh giá chung' || e.evaluation_type === 'Cuối khóa') || { comment: 'Đạt yêu cầu chuyên môn và đạo đức hành nghề.' };

    return `
      <div class="print-certificate">
        <div class="cert-header">
          <div class="cert-header-left">
            <div class="hospital-name">TRUNG TÂM Y TẾ LIÊN CHIỂU</div>
            <div class="hospital-sub">SỐ: ......./GXN-TTYT</div>
          </div>
          <div class="cert-header-right">
            <div class="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div class="national-sub">Độc lập - Tự do - Hạnh phúc</div>
            <div class="divider-line"></div>
          </div>
        </div>

        <div class="cert-title" style="margin-top: 25px; margin-bottom: 25px;">
          GIẤY XÁC NHẬN<br>
          HOÀN THÀNH QUÁ TRÌNH THỰC HÀNH
        </div>

        <div class="cert-body">
          <p class="cert-intro">Căn cứ Luật Khám bệnh, chữa bệnh ngày 09 tháng 01 năm 2023;</p>
          <p class="cert-intro">Căn cứ Nghị định số 96/2023/NĐ-CP ngày 30 tháng 12 năm 2023 của Chính phủ quy định chi tiết một số điều của Luật Khám bệnh, chữa bệnh;</p>
          
          <p class="cert-statement">Người đứng đầu cơ sở khám bệnh, chữa bệnh: <strong>Trung tâm Y tế khu vực Liên Chiểu</strong> xác nhận:</p>
          
          <table class="cert-info-table">
            <tr>
              <td style="width: 25%;">Họ và tên người thực hành:</td>
              <td style="width: 45%;"><strong>${practitioner.name.toUpperCase()}</strong></td>
              <td style="width: 15%;">Giới tính:</td>
              <td style="width: 15%;">${practitioner.gender}</td>
            </tr>
            <tr>
              <td>Ngày, tháng, năm sinh:</td>
              <td>${dob}</td>
              <td>Số điện thoại:</td>
              <td>${practitioner.phone || 'N/A'}</td>
            </tr>
            <tr>
              <td>Văn bằng chuyên môn:</td>
              <td colspan="3">${practitioner.degree}</td>
            </tr>
            <tr>
              <td>Đã thực hành tại cơ sở:</td>
              <td colspan="3">Trung tâm Y tế khu vực Liên Chiểu</td>
            </tr>
            <tr>
              <td>Thời gian thực hành:</td>
              <td colspan="3">Từ ngày <strong>${startDate}</strong> đến ngày <strong>${endDate}</strong> (${durationMonths} tháng)</td>
            </tr>
            <tr>
              <td>Phạm vi hành nghề thực hành chuyên môn:</td>
              <td colspan="3">Khám bệnh, chữa bệnh chuyên khoa <strong>${practitioner.specialty}</strong></td>
            </tr>
            <tr>
              <td>Người hướng dẫn:</td>
              <td colspan="3"><strong>${supervisor ? supervisor.name : 'N/A'}</strong> (Số GPHN: ${supervisor ? supervisor.license_number : 'N/A'})</td>
            </tr>
          </table>

          <div class="cert-evaluation">
            <h4 style="margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC THỰC HÀNH CHUYÊN MÔN</h4>
            <div class="eval-grid">
              <div>1. Năng lực chuyên môn thực hành: <strong>Đạt</strong></div>
              <div>2. Đạo đức nghề nghiệp: <strong>Đạt</strong></div>
              <div>3. Chấp hành các quy định pháp luật: <strong>Đạt</strong></div>
              <div>4. Giao tiếp, ứng xử: <strong>Đạt</strong></div>
              <div>5. Đảm bảo an toàn người bệnh: <strong>Đạt</strong></div>
            </div>
            <p style="margin-top: 10px;"><strong>Nhận xét chung của cơ sở:</strong> ${generalEval.comment}</p>
          </div>
        </div>

        <div class="cert-footer">
          <div class="cert-footer-left">
            <div style="font-style: italic;">Nơi nhận:</div>
            <div style="font-size: 11px;">- Như trên;</div>
            <div style="font-size: 11px;">- Lưu VT, Phòng ĐT.</div>
          </div>
          <div class="cert-footer-right">
            <div class="location-date">Đà Nẵng, ${formattedToday}</div>
            <div class="signer-title">GIÁM ĐỐC TRUNG TÂM Y TẾ</div>
            <div class="signer-sub">(Ký tên, ghi rõ họ tên và đóng dấu)</div>
            <div class="signer-space"></div>
            <div class="signer-name">PGS. TS. NGUYỄN LÂM SƠN</div>
          </div>
        </div>
      </div>
    `;
  },

  // Mẫu theo Thông tư 21/2020/TT-BYT (Đối với Bác sĩ thực hành 18 tháng cũ)
  generateCircular21Certificate(practitioner, supervisor, evaluations) {
    const today = new Date();
    const formattedToday = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
    const dob = new Date(practitioner.dob).toLocaleDateString('vi-VN');
    const startDate = new Date(practitioner.start_date).toLocaleDateString('vi-VN');
    
    const endDateObj = new Date(practitioner.start_date);
    endDateObj.setMonth(endDateObj.getMonth() + 18);
    const endDate = endDateObj.toLocaleDateString('vi-VN');

    const generalEval = evaluations.find(e => e.department === 'Đánh giá chung' || e.evaluation_type === 'Cuối khóa') || { comment: 'Hoàn thành đầy đủ thời gian 18 tháng thực hành lâm sàng các chuyên khoa theo quy định của Thông tư 21/2020/TT-BYT.' };

    return `
      <div class="print-certificate">
        <div class="cert-header">
          <div class="cert-header-left">
            <div class="hospital-name">TRUNG TÂM Y TẾ LIÊN CHIỂU</div>
            <div class="hospital-sub">SỐ: ......./GXN-TTYT</div>
          </div>
          <div class="cert-header-right">
            <div class="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div class="national-sub">Độc lập - Tự do - Hạnh phúc</div>
            <div class="divider-line"></div>
          </div>
        </div>

        <div class="cert-title" style="margin-top: 25px; margin-bottom: 25px;">
          GIẤY XÁC NHẬN<br>
          QUÁ TRÌNH THỰC HÀNH Y KHOA ĐA KHOA
          <div style="font-size: 13px; font-weight: normal; margin-top: 5px; font-style: italic;">(Theo Thông tư số 21/2020/TT-BYT)</div>
        </div>

        <div class="cert-body">
          <p class="cert-intro">Căn cứ Luật Khám bệnh, chữa bệnh số 40/2009/QH12 ngày 23 tháng 11 năm 2009;</p>
          <p class="cert-intro">Căn cứ Thông tư số 21/2020/TT-BYT ngày 30 tháng 11 năm 2020 của Bộ Y tế quy định về hướng dẫn thực hành để cấp chứng chỉ hành nghề khám bệnh, chữa bệnh đa khoa đối với bác sỹ y khoa;</p>
          
          <p class="cert-statement">Giám đốc <strong>Trung tâm Y tế khu vực Liên Chiểu</strong> xác nhận:</p>
          
          <table class="cert-info-table">
            <tr>
              <td style="width: 25%;">Họ và tên người thực hành:</td>
              <td style="width: 45%;"><strong>${practitioner.name.toUpperCase()}</strong></td>
              <td style="width: 15%;">Giới tính:</td>
              <td style="width: 15%;">${practitioner.gender}</td>
            </tr>
            <tr>
              <td>Ngày, tháng, năm sinh:</td>
              <td>${dob}</td>
              <td>Điện thoại liên hệ:</td>
              <td>${practitioner.phone || 'N/A'}</td>
            </tr>
            <tr>
              <td>Văn bằng tốt nghiệp:</td>
              <td colspan="3">${practitioner.degree}</td>
            </tr>
            <tr>
              <td>Thời gian thực hành:</td>
              <td colspan="3">Từ ngày <strong>${startDate}</strong> đến ngày <strong>${endDate}</strong> (Tổng thời gian là 18 tháng)</td>
            </tr>
            <tr>
              <td>Cơ cấu luân khoa thực hành:</td>
              <td colspan="3" style="font-size: 13px; line-height: 1.4;">
                - Chuyên khoa Nội (bao gồm Hồi sức cấp cứu): 05 tháng<br>
                - Chuyên khoa Ngoại: 03 tháng<br>
                - Chuyên khoa Sản phụ khoa: 03 tháng<br>
                - Chuyên khoa Nhi: 04 tháng<br>
                - Chuyên khoa khác: 03 tháng
              </td>
            </tr>
            <tr>
              <td>Người hướng dẫn chính:</td>
              <td colspan="3"><strong>${supervisor ? supervisor.name : 'N/A'}</strong> (Số CCHN: ${supervisor ? supervisor.license_number : 'N/A'})</td>
            </tr>
          </table>

          <div class="cert-evaluation">
            <h4 style="margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">KẾT QUẢ ĐÁNH GIÁ THỰC HÀNH LÂM SÀNG</h4>
            <p>1. Năng lực thực hành chuyên môn: <strong>Đạt yêu cầu</strong></p>
            <p>2. Đạo đức nghề nghiệp, giao tiếp ứng xử, an toàn y khoa: <strong>Đạt yêu cầu</strong></p>
            <p style="margin-top: 8px;"><strong>Nhận xét:</strong> ${generalEval.comment}</p>
          </div>
        </div>

        <div class="cert-footer">
          <div class="cert-footer-left">
            <div style="font-style: italic;">Nơi nhận:</div>
            <div style="font-size: 11px;">- Học viên thực hành;</div>
            <div style="font-size: 11px;">- Lưu phòng TCCB, phòng Đào tạo.</div>
          </div>
          <div class="cert-footer-right">
            <div class="location-date">Đà Nẵng, ${formattedToday}</div>
            <div class="signer-title">GIÁM ĐỐC TRUNG TÂM Y TẾ</div>
            <div class="signer-sub">(Ký tên, ghi rõ họ tên và đóng dấu)</div>
            <div class="signer-space"></div>
            <div class="signer-name">PGS. TS. NGUYỄN LÂM SƠN</div>
          </div>
        </div>
      </div>
    `;
  },

  // Mẫu số 08 Phụ lục I ban hành kèm theo Nghị định số 96/2023/NĐ-CP
  // Đơn đề nghị cấp giấy phép hành nghề khám bệnh, chữa bệnh
  generateDecree96ApplicationForm(practitioner) {
    const today = new Date();
    const formattedToday = `ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
    const dob = new Date(practitioner.dob).toLocaleDateString('vi-VN');

    return `
      <div class="print-certificate">
        <div class="cert-header">
          <div class="cert-header-left" style="width: 35%;">
            <div style="font-size: 12px; font-weight: bold;">HỌ TÊN: ${practitioner.name.toUpperCase()}</div>
            <div style="font-size: 11px;">Số điện thoại: ${practitioner.phone || 'N/A'}</div>
          </div>
          <div class="cert-header-right" style="width: 65%;">
            <div class="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div class="national-sub">Độc lập - Tự do - Hạnh phúc</div>
            <div class="divider-line"></div>
          </div>
        </div>

        <div class="cert-title" style="margin-top: 40px; margin-bottom: 30px;">
          ĐƠN ĐỀ NGHỊ<br>
          CẤP GIẤY PHÉP HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH
        </div>

        <div class="cert-body" style="font-size: 14px;">
          <p style="text-align: center; margin-bottom: 20px; font-weight: bold;">
            Kính gửi: Sở Y tế Thành phố Đà Nẵng
          </p>

          <table class="cert-info-table">
            <tr>
              <td style="width: 25%;">Họ và tên người đề nghị:</td>
              <td colspan="3"><strong>${practitioner.name.toUpperCase()}</strong></td>
            </tr>
            <tr>
              <td>Ngày, tháng, năm sinh:</td>
              <td style="width: 35%;">${dob}</td>
              <td style="width: 15%;">Giới tính:</td>
              <td>${practitioner.gender}</td>
            </tr>
            <tr>
              <td>Số CCCD/Hộ chiếu:</td>
              <td colspan="3">...................................................................................................................................</td>
            </tr>
            <tr>
              <td>Địa chỉ thường trú:</td>
              <td colspan="3">...................................................................................................................................</td>
            </tr>
            <tr>
              <td>Chỗ ở hiện nay:</td>
              <td colspan="3">...................................................................................................................................</td>
            </tr>
            <tr>
              <td>Văn bằng chuyên môn:</td>
              <td colspan="3">${practitioner.degree}</td>
            </tr>
            <tr>
              <td>Chức danh đề nghị cấp:</td>
              <td colspan="3"><strong>${practitioner.specialty}</strong></td>
            </tr>
            <tr>
              <td>Đăng ký phạm vi hoạt động chuyên môn đề nghị cấp:</td>
              <td colspan="3">Khám bệnh, chữa bệnh chuyên khoa ${practitioner.specialty}</td>
            </tr>
          </table>

          <p style="text-indent: 20px; margin-bottom: 12px; text-align: justify;">
            Đề nghị cơ quan cấp Giấy phép hành nghề khám bệnh, chữa bệnh cho tôi theo quy định của pháp luật.
          </p>

          <p style="font-weight: bold; margin-top: 15px; margin-bottom: 5px;">Hồ sơ gửi kèm bao gồm:</p>
          <ol style="margin-left: 25px; line-height: 1.6;">
            <li>Đơn đề nghị cấp giấy phép hành nghề khám bệnh, chữa bệnh (Mẫu số 08).</li>
            <li>Giấy xác nhận quá trình thực hành y khoa (Mẫu số 07).</li>
            <li>Bản sao hợp lệ văn bằng tốt nghiệp chuyên môn.</li>
            <li>Bản sao CCCD.</li>
            <li>Giấy khám sức khỏe còn thời hạn 06 tháng.</li>
            <li>Hai (02) ảnh chân dung màu kích thước 4cm x 6cm chụp trên nền trắng.</li>
          </ol>

          <p style="text-indent: 20px; margin-top: 20px; text-align: justify;">
            Tôi xin cam đoan các thông tin nêu trong đơn đề nghị và các tài liệu đính kèm là hoàn toàn trung thực, nếu có gì sai sót tôi xin chịu trách nhiệm hoàn toàn trước pháp luật.
          </p>
        </div>

        <div class="cert-footer" style="margin-top: 40px;">
          <div class="cert-footer-left" style="width: 40%;">
            <div style="font-size: 11px; font-style: italic;">Hồ sơ gửi kèm:<br>- Bản sao bằng cấp<br>- Giấy xác nhận thực hành (Mẫu 07)</div>
          </div>
          <div class="cert-footer-right" style="width: 50%;">
            <div class="location-date">Đà Nẵng, ${formattedToday}</div>
            <div class="signer-title" style="margin-top: 5px;">NGƯỜI LÀM ĐƠN</div>
            <div class="signer-sub">(Ký tên và ghi rõ họ tên)</div>
            <div class="signer-space" style="height: 60px;"></div>
            <div class="signer-name">${practitioner.name}</div>
          </div>
        </div>
      </div>
    `;
  }
};
