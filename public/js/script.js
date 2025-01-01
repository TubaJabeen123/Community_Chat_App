document.addEventListener('DOMContentLoaded', function() {
  let currentUserName = null;
  let currentRoom = null;
  let socket = null;

  const preJoinScreen = document.getElementById('preJoinScreen');
  const joinedRoomsList = document.getElementById('joinedRoomsList');
  const otherRoomsList = document.getElementById('otherRoomsList');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinUserNameInput = document.getElementById('joinUserName');
  const joinRoomNameInput = document.getElementById('joinRoomName');
  const createUserNameInput = document.getElementById('createUserName');
  const createRoomNameInput = document.getElementById('createRoomName');
  const createRoomBioInput = document.getElementById('createRoomBio');
  const notification = document.getElementById('notification');
  let roomList = null;
  let uname = null;
  let currentUserNameSpan = null;
  let joinDate = null;
  let output = null;
  let chatInput = null;
  let sendBtn = null;
  let roomBio = null;
  let roomCreationDate = null;
  let roomCreator = null;
  let emojiBtn = null;
  let emojiPicker = null;
  let logoutBtn = null;
  let feedbackDiv = null;

function initializeScreenElements() {
      if(window.location.pathname === '/screen'){
         console.log("inside screen path");
         roomList = document.getElementById('room-list');
          uname = document.getElementById('Uname');
         currentUserNameSpan = document.getElementById('currentUserName');
       joinDate = document.getElementById('joinDate');
        output = document.getElementById('output');
       chatInput = document.getElementById('message-input');
         sendBtn = document.getElementById('send');
        roomBio = document.getElementById('roomBio');
        roomCreationDate = document.getElementById('roomCreationDate');
          roomCreator = document.getElementById('roomCreator');
        emojiBtn = document.getElementById('emoji-btn');
         emojiPicker = document.getElementById('emojiPicker');
      logoutBtn = document.querySelector('.logout a');
       feedbackDiv = document.getElementById('feedback');

     if (logoutBtn) {
          logoutBtn.onclick=function() {
              console.log('logout button clicked!');
                 currentUserName = null;
               currentRoom = null;
              if(socket){
                  socket.disconnect();
               }
               localStorage.removeItem('communityAppData');
                window.location.href = '/';
             }
          }

    }
}

  function showNotification(message) {
       if(notification){
            notification.textContent = message;
           notification.classList.remove('hidden');
            setTimeout(() => {
              notification.classList.add('hidden');
            }, 3000);
       }
  }
  function initSocket(){
        if(!socket){
          socket = io();
          socket.on('message', (message)=>{
             renderChatMessage(message)
       });
        socket.on('userJoined', (userName) =>{
           showNotification(`User ${userName} Joined!`);
         });
          socket.on('messageRead', (messageId)=>{
               markMessageAsReadUi(messageId);
          })
        socket.on('participants', (participants)=>{
            renderParticipants(participants);
        })
      }
 }

 async function loadRooms(){
      try{
         const response = await fetch('/rooms');
           const rooms = await response.json();
             console.log('loaded rooms', rooms)
         renderPreJoinRooms(rooms);
      }catch(e){
        console.error("Error while loading rooms", e);
        showNotification("Error while fetching rooms!")
       }
  }

function renderPreJoinRooms(rooms){
      if(joinedRoomsList && otherRoomsList){
           joinedRoomsList.innerHTML = '';
           otherRoomsList.innerHTML = '';
          const userJoinedRooms = getJoinedRooms(currentUserName);
           if(userJoinedRooms){
                userJoinedRooms.forEach(room => {
                   const roomDetail = rooms.find(r=>r.roomName === room.roomName)
                  if(roomDetail){
                        const li = document.createElement('li');
                      li.textContent = `${roomDetail.roomName} (Joined)`;
                      li.addEventListener('click', ()=>handleJoinRoom(roomDetail.roomName, room.userName));
                    joinedRoomsList.appendChild(li);
                 }
             })
         }
         rooms.forEach(room => {
               if(!userJoinedRooms?.find(r=>r.roomName === room.roomName)){
                     const li = document.createElement('li');
                     li.textContent = room.roomName;
                    li.addEventListener('click', ()=>handleJoinRoom(room.roomName));
                     otherRoomsList.appendChild(li);
                }
        })
     }
}

 function getJoinedRooms(userName){
      const data = localStorage.getItem('communityAppData');
        if(data){
            const parsedData = JSON.parse(data);
            if(parsedData && parsedData.joinedRooms){
                return parsedData.joinedRooms.filter(jr=>jr.userName === userName);
            }
         }
         return null;
 }
 function handleJoinRoom(roomName, userName=null) {
       if(!userName){
             currentUserName = joinUserNameInput.value;
          }else{
              currentUserName = userName;
         }
          if(!currentUserName){
            showNotification("Please enter your user name!");
             return;
        }
         currentRoom = roomName;
          let joinedData = localStorage.getItem('communityAppData');
        let parsedData = {joinedRooms: []};
         if(joinedData){
             parsedData = JSON.parse(joinedData);
             if(!parsedData.joinedRooms){
                parsedData.joinedRooms = [];
             }
          }
      if (!parsedData.joinedRooms.find(jr=>jr.userName === currentUserName && jr.roomName===roomName)) {
        parsedData.joinedRooms.push({ userName: currentUserName, roomName: roomName });
          localStorage.setItem('communityAppData', JSON.stringify(parsedData));
        }
          console.log('join room', {userName: currentUserName, roomName: currentRoom})
         initSocket();
          if(socket){
            socket.emit('joinRoom', {userName: currentUserName, roomName: currentRoom});
          }
         window.location.href = '/screen';
   }

   function renderDashboardRooms() {
      if(roomList){
          roomList.innerHTML = '';
         const userJoinedRooms = getJoinedRooms(currentUserName);
           if(userJoinedRooms){
                userJoinedRooms.forEach(room => {
                   const li = document.createElement('li');
                    li.innerHTML = `<a href="#"><i class="fa fa-circle-o-notch"></i><span>${room.roomName}</span></a>`
                   li.addEventListener('click', () => handleRoomChange(room.roomName));
                    roomList.appendChild(li);
               });
            }
        fetch('/rooms').then(response=>response.json()).then(rooms =>{
            rooms.forEach(room => {
                if(!userJoinedRooms?.find(r=>r.roomName === room.roomName)){
                   const li = document.createElement('li');
                      li.innerHTML = `<a href="#"><i class="fa fa-circle-o-notch"></i><span>${room.roomName}</span></a>`
                      li.addEventListener('click', () => handleRoomChange(room.roomName));
                   roomList.appendChild(li);
                }
            })
         })
     }
   }

  function handleRoomChange(roomName) {
    currentRoom = roomName;
     renderApp();
     if(socket){
       socket.emit('joinRoom', {userName: currentUserName, roomName: currentRoom});
      }
  }

  function renderApp() {
    console.log("render App is called!");
    if (window.location.pathname === '/screen') {
      console.log("inside screen condition");
         if(!uname){
             uname = document.getElementById('Uname');
          }
        if(currentUserNameSpan){
           currentUserNameSpan = document.getElementById('currentUserName');
         }
        if(joinDate){
          joinDate = document.getElementById('joinDate');
        }
        if(!chatInput){
             chatInput = document.getElementById('message-input');
        }
       if(!sendBtn){
         sendBtn = document.getElementById('send');
        }
       if(!emojiBtn){
          emojiBtn = document.getElementById('emoji-btn');
      }
      if(!emojiPicker){
          emojiPicker = document.getElementById('emojiPicker');
         }

        renderDashboardRooms();
        renderUserProfile();
         renderChatMessages();
         fetchParticipants();
         renderRoomInfo();

         if(currentUserNameSpan){
             currentUserNameSpan.textContent = currentUserName;
         }
        if(joinDate){
          joinDate.textContent = new Date().toLocaleDateString();
       }
    }
 }

function renderUserProfile() {
  if(uname){
       uname.textContent = currentUserName;
     }
}
 function fetchMessages(){
  console.log("fetch message called", currentRoom)
     fetch(`/messages/${currentRoom}`).then(response=>response.json()).then(messages=>{
        if(output){
               console.log("messages", messages)
                output.innerHTML = '';
               messages.forEach(message => {
                     renderChatMessage(message);
                })
              output.scrollTop = output.scrollHeight;
          }
     }).catch(e=>{
         console.error("Error fetching messages", e)
         showNotification("Error while fetching messages")
     })
}
  function renderChatMessage(message){
      if(output){
          const messageItem = document.createElement('li');
          messageItem.innerHTML = `
          <span class="name">${message.userName}</span>
            <span class="message">${message.text}
              <span class="msg-time">${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
         `;
       if(!message.read && message.userName !== currentUserName){
              messageItem.classList.add('unread');
         }
         output.appendChild(messageItem)
         if(!message.read && message.userName !== currentUserName){
            if(socket){
                socket.emit('markMessageAsRead', {_id: message._id, messageId: message._id.toString(), roomName: message.roomName})
            }
      }
    }
 }
 function markMessageAsReadUi(messageId) {
      const messageElement = output?.querySelector(`.unread`);
      if(messageElement){
          messageElement.classList.remove('unread')
      }
  }
 function fetchParticipants(){
   console.log('fetchParticipants called', currentRoom);
       fetch(`/participants/${currentRoom}`).then(response=>response.json()).then(participants=>{
           console.log("participants", participants)
            renderParticipants(participants)
     }).catch(e=>showNotification("Error while fetching participants"))
}

function renderParticipants(participants) {
  console.log("renderparticipants", participants);
   const participantsDiv =  document.getElementById('participants');
     if(participantsDiv){
        participantsDiv.innerHTML = '';
         const room = currentRoom;
         fetch('/rooms').then(res=>res.json()).then(rooms=>{
            const roomAdmin = rooms.find(r=>r.roomName === room)?.createdBy;
              participants.forEach(participant => {
                const li = document.createElement('li');
                   li.innerHTML = `<span>${participant.userName} ${participant.userName === roomAdmin ? '(Admin)' : ''}  <i class="fa fa-circle ${participant.online ? 'online' : 'offline'}"></i></span>`
                   participantsDiv.appendChild(li);

              });
       })
   }
 }

function renderRoomInfo() {
      if(roomBio){
         roomBio.textContent = '';
     }
      if(roomCreationDate){
           roomCreationDate.textContent = '';
     }
     if(roomCreator){
         roomCreator.textContent = '';
    }
     if(roomBio && roomCreationDate && roomCreator){
          fetch('/rooms').then(res=>res.json()).then(rooms=>{
             const room = rooms.find(room => room.roomName === currentRoom);
               if (room) {
                  if(roomBio){
                    roomBio.textContent = room.bio;
                  }
                   if(roomCreationDate){
                     roomCreationDate.textContent = new Date(room.createdAt).toLocaleDateString();
                     }
                 if(roomCreator){
                    roomCreator.textContent = room.createdBy;
                 }
           }
     })
 }
}

if(sendBtn){
   sendBtn.addEventListener('click', () => {
     if (chatInput && socket) {
         const messageText = chatInput.value.trim();
         if (messageText) {
              const message = {
                userName: currentUserName,
                 roomName: currentRoom,
                   text: messageText,
                }
               if (feedbackDiv) {
                  feedbackDiv.textContent = 'Sending...';
                    feedbackDiv.style.color = "green";
                  }
                 socket.emit('sendMessage', message, (ack) => {
                   if (feedbackDiv) {
                     if(ack.status === 'ok'){
                        feedbackDiv.textContent = 'Message sent';
                         setTimeout(()=>{
                             feedbackDiv.textContent = ''
                        }, 2000)
                   } else {
                         feedbackDiv.textContent = 'Message not sent, try again';
                        feedbackDiv.style.color = 'red';
                        setTimeout(()=>{
                           feedbackDiv.textContent = ''
                         }, 2000)
                   }
                 }
             });
              chatInput.value = '';
          }
    }
});
}
if(chatInput){
    chatInput.addEventListener('keypress', (event) => {
        if(event.key === 'Enter'){
          if(sendBtn && socket){
                sendBtn.click();
               event.preventDefault();
          }
    }
})
}
  joinRoomBtn.addEventListener('click', ()=>{
      handleJoinRoom(joinRoomNameInput.value);
       joinUserNameInput.value = '';
      joinRoomNameInput.value='';
 })
  createRoomBtn.addEventListener('click', ()=>{
      const roomName = createRoomNameInput.value;
     const userName = createUserNameInput.value;
    const roomBio = createRoomBioInput.value;
      if(roomName && userName && roomBio){
        fetch('/rooms', {
               method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                 },
                body: JSON.stringify({roomName: roomName, createdBy: userName, bio: roomBio})
           }).then(response=>response.json()).then(data=>{
              if(data.error){
                  showNotification(data.error)
             }else{
                   createRoomNameInput.value = '';
                  createUserNameInput.value = '';
                  createRoomBioInput.value = '';
                  showNotification(`Room ${roomName} created`)
                 loadRooms();
            }
          })
     }else{
        showNotification("Please fill all the credentials!");
  }
})

if(emojiBtn){
  emojiBtn.addEventListener('click', (e)=>{
      emojiPicker.classList.toggle('hidden');
        if(!emojiPicker.innerHTML){
              const emojis = [
                 '😀', '😂', '😊', '😍', '😎', '🤔', '😴', '😡', '💩', '👻', '❤️', '👍', '🙌', '🎉', '🚀'
              ];
              emojis.forEach(emoji => {
                const btn = document.createElement('button');
                    btn.textContent = emoji;
                     btn.addEventListener('click', ()=> {
                         if(chatInput){
                           chatInput.value += emoji;
                        }
                         emojiPicker.classList.add('hidden');
                  })
                  emojiPicker.appendChild(btn);
            })
       }
    e.stopPropagation();
});
}
document.addEventListener('click', (e)=>{
 if(emojiPicker && !emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)){
       emojiPicker.classList.add('hidden')
    }
});
  loadRooms();
 if(window.location.pathname === '/screen' && currentRoom && currentUserName){
  console.log('init socket and render app');
     initSocket();
      renderApp();
     fetchMessages()
  }
 });