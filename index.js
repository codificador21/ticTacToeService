const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});

const games = {}; 

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new game
  socket.on("createGame", (callback) => {
    const roomId = Math.random().toString(36).substr(2, 6);
    games[roomId] = {
      board: Array(9).fill(null),
      isXTurn: true,
      players: [socket.id],
      winner: null,
    };
    socket.join(roomId);
    console.log(`Game created with ID: ${roomId} by user: ${socket.id}`);
    callback(roomId);
  });

  // Join an existing game
  socket.on("joinGame", (roomId, callback) => {
    const game = games[roomId];
    if (game) {
      if (game.players.length < 2) {
        game.players.push(socket.id);
        socket.join(roomId);
        console.log(`User ${socket.id} joined game ${roomId}`);
        callback({ success: true, board: game.board, isXTurn: game.isXTurn });
      } else {
        console.log(`Game ${roomId} is full. User ${socket.id} cannot join.`);
        callback({ success: false, message: "Game is full" });
      }
    } else {
      console.log(`Game ${roomId} does not exist. User ${socket.id} cannot join.`);
      callback({ success: false, message: "Game does not exist" });
    }
  });

  // Handle moves
  socket.on("makeMove", (roomId, index, callback) => {
    const game = games[roomId];
    if (game && game.board[index] === null && !game.winner) {
      const move = game.isXTurn ? "X" : "O";
      game.board[index] = move;
      game.isXTurn = !game.isXTurn;
      game.winner = checkWinner(game.board);

      console.log(`Move made in game ${roomId} by ${socket.id}:`, game.board);

      // Notify all players in the room of the updated game state
      io.to(roomId).emit("updateGame", {
        board: game.board,
        isXTurn: game.isXTurn,
        winner: game.winner,
      });

      callback({ success: true });
    } else {
      console.log(`Invalid move in game ${roomId} by ${socket.id}`);
      callback({ success: false, message: "Invalid move or game already won" });
    }
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Remove the player from games and clean up empty games
    for (const [roomId, game] of Object.entries(games)) {
      if (game.players.includes(socket.id)) {
        game.players = game.players.filter((player) => player !== socket.id);
        console.log(`User ${socket.id} left game ${roomId}`);

        // Notify the remaining player if one is left
        if (game.players.length === 1) {
          io.to(game.players[0]).emit("opponentLeft", {
            message: "Your opponent has left the game",
          });
        }

        // Clean up the game if no players remain
        if (game.players.length === 0) {
          delete games[roomId];
          console.log(`Game ${roomId} deleted due to no active players`);
        }
      }
    }
  });

  socket.on("restartGame", (roomId, callback) => {
    const game = games[roomId];
    if (game) {
      // Reset the game state
      game.board = Array(9).fill(null);
      game.isXTurn = true;
      game.winner = null;
  
      console.log(`Game ${roomId} restarted by ${socket.id}`);
  
      // Notify all players in the room of the reset game state
      io.to(roomId).emit("updateGame", {
        board: game.board,
        isXTurn: game.isXTurn,
        winner: game.winner,
      });
  
      callback({ success: true });
    } else {
      console.log(`Attempted restart for non-existent game ${roomId} by ${socket.id}`);
      callback({ success: false, message: "Game does not exist" });
    }
  });
});

// Handle game restart



// Helper function to check for a winner
function checkWinner(board) {
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let [a, b, c] of winningCombinations) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.includes(null) ? null : "Draw"; 
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
