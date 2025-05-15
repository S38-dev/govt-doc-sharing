jest.setTimeout(10000);

// Suppress console.error output during tests to avoid clutter
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});