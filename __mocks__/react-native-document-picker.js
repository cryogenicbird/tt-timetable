// Jest 假实现：测试环境没有原生文件选择器
module.exports = {
  pick: jest.fn(),
  pickMultiple: jest.fn(),
  isCancel: jest.fn(() => false),
  types: {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    allFiles: '*/*',
  },
};
