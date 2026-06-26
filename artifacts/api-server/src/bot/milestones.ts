export interface Milestone {
  count: number;
  lore: string;
}

const HUNDRED_TEMPLATES = [
  "Đã gửi {count} tin nhắn. Bàn phím bắt đầu run rẩy.",
  "Ghi nhận {count} tin nhắn. Server đã nộp đơn kiện vì ô nhiễm tiếng ồn.",
  "{count} tin nhắn. Các nhà sử học bắt đầu ghi chép.",
  "Con số đạt {count}. Ai đó gọi cho cấp cứu đi.",
  "{count} tin nhắn. Với tốc độ này, họ sẽ tồn tại lâu hơn cả server.",
  "Thêm {count} tin nhắn được ghi lại. Khoảng trống vũ trụ vẫn đang phản hồi.",
  "{count} tin nhắn vững chắc. Vẫn chưa có dấu hiệu dừng lại.",
  "Các nhà khoa học ước tính {count} tin nhắn tương đương khoảng một tuần suy nghĩ của họ.",
  "{count} tin nhắn. Các mod đã chấp nhận số phận.",
  "Tin nóng: thành viên địa phương gửi tin nhắn thứ {count}. Cả server kinh hoàng.",
];

const SPECIAL_MILESTONES: Record<number, string> = {
  100: "Lần đầu để lại dấu ấn với vỏn vẹn 100 tin nhắn. Các bậc trưởng lão đã chú ý.",
  500: "Đã gửi 500 tin nhắn vào khoảng không. Đáng sợ thay, khoảng không đã bắt đầu trả lời.",
  1000: "Sau 1.000 tin nhắn, đã bị bắt buộc tham dự mọi buổi họp mặt server. Không có ngoại lệ.",
  2000: "2.000 tin nhắn. Người ta đề xuất dựng tượng đài. Ngân sách đang chờ duyệt.",
  5000: "5.000 tin nhắn. Các học giả tranh luận liệu họ có ngủ không hay chỉ reload Discord giữa các giấc ngủ ngắn.",
  10000: "10.000 tin nhắn. Bài hát đã được viết. Đền thờ đã được dựng. Dân làng thì thầm tên họ.",
  25000: "25.000 tin nhắn. Các sử gia server đã hết mực. Một kỷ nguyên mới bắt đầu.",
  50000: "50.000 tin nhắn. Lúc này họ chính là server. Server chính là họ. Chúng ta đang sống bên trong cuộc trò chuyện của họ.",
};

function getLoreForCount(count: number): string {
  if (SPECIAL_MILESTONES[count]) {
    return SPECIAL_MILESTONES[count]!;
  }
  const index = Math.floor(count / 100) % HUNDRED_TEMPLATES.length;
  const template = HUNDRED_TEMPLATES[index]!;
  return template.replace("{count}", count.toLocaleString("vi-VN"));
}

export const MILESTONES: Milestone[] = Array.from(
  { length: 500 },
  (_, i) => {
    const count = (i + 1) * 100;
    return { count, lore: getLoreForCount(count) };
  },
);

export function getMilestone(
  previousCount: number,
  newCount: number,
): Milestone | null {
  for (const milestone of MILESTONES) {
    if (previousCount < milestone.count && newCount >= milestone.count) {
      return milestone;
    }
  }
  return null;
}
