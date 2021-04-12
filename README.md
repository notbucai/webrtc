# WebRTC DEMO

花了两天时间简单了解了一下`WEB RTC`，并由此写入三个DEMO。

1. p2p 点对点
2. o2m 一对多
3. live 直播

目前主要都是按`p2p`进行的简单扩展。

## WebRTC 简单了解

目前资料不算少，不过确实也不多，而且理论偏多，新手入门其实还是有点压力的。  

这边推荐几个资料和视频。

[MDN 文档](https://developer.mozilla.org/zh-CN/docs/Web/API/WebRTC_API) 记得出问题看看文档先  

[WebRTC samples](https://webrtc.github.io/samples/) 没有思路的时候记得看看  

[哔哩哔哩 - 一只斌](https://space.bilibili.com/349060406) 这个b站up，大概算是由浅入深讲了这个东西，但是有些基础概念被带过了（应该主要是我基础较薄弱），其中圣诞特辑中的流程其实还是比较清晰的。

[知乎 - 为什么webrtc那么贵？](https://www.zhihu.com/question/391589748/answer/1190518209)  注意看评论区

[知乎 - 可以用WebRTC来做视频直播吗？](https://www.zhihu.com/question/25497090/answer/72397450)  注意看评论区

## WebRTC 的一些概念

WebRTC基础情况下只需要一个 ‘信令服务’ 作为业务需求，并不需要直接管理流。

### p2p 
点对点通信（pc与pc直接通信），不通过服务器

### 信令服务
用于建立通信和业务交互的服务端

### SDP
存放媒体信息、会话的描述。如编码解码信息

### NAT / STUN / TURN / ice
strn

用于p2p连接。（下面仅个人理解

由于没有公网ip的两个主机没有办法直接进行直接通信，所以需要一个“中转的服务器”，但是由于中转服务器过于依赖服务器带宽，所以采用`NAT穿刺`，这样双方通信就不需要依赖服务器。

ice  
整合了STUN和TURN的框架

实际具体不需要管，ice 服务器可以使用公开的

## 实践 

webrtc建立还是很简单的，只需要交换双方`sdp`和`ice-candidate`，即可建立通信。


### 具体流程
p2p 1对1 视频

> 呼叫方创建 `offer sdp` 接收方根据 `offer sdp` 创建 `answer sdp`

一、 sdp 交换

1. **呼叫方** 建立WebRTC
2. **接收方** 等待 信令服务器 转发 类型为`offer` 的 `sdp`
3. **呼叫方** 监听`onnegotiationneeded`并创建 `offer sdp` 并调用 `setLocalDescription` 设置为本地描述
4. **呼叫方** 向 信令服务器 发送 `offer sdp` 并监听 `answer sdp`
5. **接收方** 得到 `offer sdp` 并调用 `setRemoteDescription` 设置为远程描述
6. **接收方** 创建 `answer sdp` 并设置本地描述（`setLocalDescription`） 同时向 信令服务器 发送 `answer sdp`
7. **呼叫方** 收到 `answer sdp` 并设远程描述（`setRemoteDescription`）

二、 ice-candidate 交换

1. 监听 `onicecandidate` 得到 `candidate` 后进行发送
2. 监听 `信令服务器` **ice-candidate** 得到后调用 `addIceCandidate`


### 获取媒体 流

```javascript
function getUserMedia(constrains) {
  let promise = null;
  if (navigator.mediaDevices.getUserMedia) {
    //最新标准API
    promise = navigator.mediaDevices.getUserMedia(constrains)
  } else if (navigator.webkitGetUserMedia) {
    //webkit内核浏览器
    promise = navigator.webkitGetUserMedia(constrains)
  } else if (navigator.mozGetUserMedia) {
    //Firefox浏览器
    promise = navagator.mozGetUserMedia(constrains)
  } else if (navigator.getUserMedia) {
    //旧版API
    promise = navigator.getUserMedia(constrains);
  }
  return promise;
}
// 得到流
const stream = await getUserMedia({
  video: true,
  audio: true,
});
// 展示
$('video').srcObject = stream;
```

### 信令服务器

demo使用 node + socket-io 做信令服务器

目前逻辑很简单，只为数据定向转发

目前主要对`sdp`和`ice candidate`进行一个定向转发

```javascript
const SocketIo = require('socket.io');
const consola = require('consola'); // log 工具

const users = new Map(); // 用户存储

/**
 * 
 * @param {http.Server} server 
 */
const signaling = (server) => {
  // 创建socketio服务
  const io = new SocketIo.Server(server);

  const p2p = io.of('/p2p');
  // 连接
  p2p.on('connect', (socket) => {
    consola.info('[%s] connect', socket.id);

    // **********
    // 用户操作
  
    // sdp 转发
    socket.on('sdp', (data) => {
      console.log('sdp data.to[%s] type[%s]', data.to, data.type);
      const user = users.get(data.to)
      if (user) {
        user.emit('sdp', data);
      }
    });
    // ice-candidate 转发
    socket.on('ice-candidate', (data) => {
      console.log('ice-candidate data.to', data.to);
      const user = users.get(data.to)
      if (user) {
        user.emit('ice-candidate', data);
      }
    });

    // 用户操作
    // **********
    
    // ----------
    // 用户操作
    socket.once('disconnect', () => {
      consola.info('[%s] disconnect', socket.id);
      users.delete(socket.id);
      p2p.emit('leave', {
        user: socket.id
      });
    });
    socket.emit('users', {
      users: Array.from(users.keys())
    });
    p2p.emit('join', {
      user: socket.id
    });
    users.set(socket.id, socket);
    // 用户操作
    // ----------
  });

};

module.exports = signaling;
```

### 建立WebRTC
这里在代码中区分了发送和接收具体可参考业务

> 呼叫方

```javascript
// ************
// 呼叫方
// ************

// 1. 建立rct连接
const pc = new RTCPeerConnection({
  iceServers: [
    {
      urls: ["stun:stun.counterpath.net:3478"] // 可以直接百度找一些开放的stun服务器
    }
  ]
});
// 2. 绑定流
const stream = await getUserMedia({
  video: true,
  audio: true,
});
// 添加媒体轨道 如果 video 和 audio 都为true 则 getTracks 可以获得两个轨道
stream.getTracks().forEach(track => pc[toUser].addTrack(track, stream));

// 3. 监听
pc.onnegotiationneeded = ()=>{
  pc
    .createOffer() // 创建 offer sdp
    .then((offer) => {
      // 设置为本地描述
      return pc.setLocalDescription(offer);
    })
    .then(() => {
      // 定向转发 sdp
      socket.emit('sdp', {
        type: 'sender',
        value: pc.localDescription
      });
    });
}
pc.onicecandidate = (ev)=>{
  // 转发 ice-candidate
  socket.emit('ice-candidate', {
    type: 'sender',
    value: ev.candidate,
  });
}
pc.ontrack = (ev)=>{
  // 这里可以的得到对方的流
  let stream = ev.streams[0];
}

// 监听 ice 和 sdp
socket.on('ice-candidate', (data)=>{
  if(data.type === 'receive'){
    const candidate = new RTCIceCandidate(data.value);
    pc.addIceCandidate(candidate)
  }
});
socket.on('sdp', (data)=>{
  if(data.type === 'receive'){
    const sdp = new RTCSessionDescription(data.value);
    pc.setRemoteDescription(sdp);
  }
});
```

> 接收方

```javascript
// ************
// 接收方
// ************

//  建立rct连接 
const pc = new RTCPeerConnection({
  iceServers: [
    {
      urls: ["stun:stun.counterpath.net:3478"] // 可以直接百度找一些开放的stun服务器
    }
  ]
});

socket.on('sdp', async (data)=>{
  if(data.type === 'sender'){
    const sdp = new RTCSessionDescription(data.value);
    pc.setRemoteDescription(sdp);
    //  绑定流
    const stream = await getUserMedia({
      video: true,
      audio: true,
    });
    // 添加媒体轨道 如果 video 和 audio 都为true 则 getTracks 可以获得两个轨道
    stream.getTracks().forEach(track => pc[toUser].addTrack(track, stream));

    // 监听
    pc.onnegotiationneeded = ()=>{
      pc
        .createAnswer() // 创建 offer sdp
        .then((answer) => {
          // 设置为本地描述
          return pc.setLocalDescription(answer);
        })
        .then(() => {
          // 定向转发 sdp
          socket.emit('sdp', {
            type: 'receive',
            value: pc.localDescription
          });
        });
    }
    pc.onicecandidate = (ev)=>{
      // 转发 ice-candidate
      socket.emit('ice-candidate', {
        type: 'receive',
        value: ev.candidate,
      });
    }
    pc.ontrack = (ev)=>{
      // 这里可以的得到对方的流
      let stream = ev.streams[0];
    }

  }
});

// 监听 ice 和 sdp
socket.on('ice-candidate', (data)=>{
  if(data.type === 'sender'){
    const candidate = new RTCIceCandidate(data.value);
    pc.addIceCandidate(candidate)
  }
});

```

