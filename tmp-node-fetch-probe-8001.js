fetch('http://127.0.0.1:8001/v1/models')
  .then(async (res) => {
    console.log(`status=${res.status}`);
    console.log(await res.text());
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
