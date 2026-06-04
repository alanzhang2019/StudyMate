const fs = require('fs');
try {
  const content = fs.readFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\dev-server.log', 'utf8');
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\check.txt', content.slice(-5000));
} catch (e) {
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\check.txt', e.message);
}
