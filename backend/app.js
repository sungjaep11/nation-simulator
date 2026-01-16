const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

// JSON 요청을 처리하기 위해 필수
app.use(express.json());

// 1. 학습 요청 보내기 (예: 프론트엔드에서 버튼 눌렀을 때)
app.post('/api/request-training', async (req, res) => {
    const trainingId = 'job_' + Date.now(); // 고유 ID 생성
    
    // GPU 서버 주소
    const gpuUrl = 'http://172.10.5.110:8000/start-train';
    
    // 내(Node.js)가 결과를 받을 주소
    // 주의: localhost 대신 실제 내부 IP나 공인 IP를 적어야 GPU가 찾아옵니다.
    const myWebhookUrl = 'http://172.10.5.145:3000/api/training-callback';

    try {
        // GPU 서버 호출
        await axios.post(gpuUrl, {
            training_id: trainingId,
            params: { epoch: 100, batch_size: 64 },
            webhook_url: myWebhookUrl
        });

        // 사용자(프론트)에게는 "요청 접수됨"이라고 바로 응답
        res.json({ success: true, message: '학습 요청을 보냈습니다.', id: trainingId });
    } catch (error) {
        console.error('GPU 서버 연결 실패:', error.message);
        res.status(500).json({ success: false, message: 'GPU 서버 에러' });
    }
});

// 2. 학습 결과 받기 (Webhook: GPU 서버가 이 주소를 호출함)
app.post('/api/training-callback', (req, res) => {
    const { training_id, status, result } = req.body;

    console.log(`\n=== [결과 도착] ===`);
    console.log(`ID: ${training_id}`);
    console.log(`상태: ${status}`);
    console.log(`결과:`, result);

    // TODO: 여기서 DB(MySQL/MongoDB) 업데이트
    // db.update({id: training_id}, { $set: { result: result } });

    res.status(200).send('OK'); // GPU 서버에게 잘 받았다고 응답
});

app.listen(PORT, () => {
    console.log(`Node.js 서버 실행 중: port ${PORT}`);
});