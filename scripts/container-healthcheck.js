const port = process.env.PORT || '3000';
const url = `http://127.0.0.1:${port}/health`;

fetch(url)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Health endpoint returned ${response.status}`);
    }
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
