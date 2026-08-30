module.exports = {
  CameraRoll: {
    getPhotos: jest.fn(async () => ({
      edges: [],
      page_info: {has_next_page: false},
    })),
  },
  useCameraRoll: jest.fn(() => [null, jest.fn(), false]),
};
