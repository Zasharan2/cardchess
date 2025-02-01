// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, child, onDisconnect, onValue, onChildAdded, onChildRemoved } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAO1dx5N_mzjnZY8X0Yl7Qe0keXoQKnEbY",
    authDomain: "cardchess-1a828.firebaseapp.com",
    databaseURL: "https://cardchess-1a828-default-rtdb.firebaseio.com",
    projectId: "cardchess-1a828",
    storageBucket: "cardchess-1a828.firebasestorage.app",
    messagingSenderId: "952584014885",
    appId: "1:952584014885:web:9579fcd05c7340d20443cc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase(app);

var c = document.getElementById("gameCanvas");
var ctx = c.getContext("2d");

var spritesheet = document.getElementById("spritesheet");

var keys = [];

document.addEventListener("keydown", function (event) {
    keys[event.key] = true;
    if (gameScreen == GAMESCREEN.ROOM && onlineCode.length < 8) {
        if (event.key.length == 1 && event.key.match(/[a-zA-Z0-9]/g)) {
            onlineCode += event.key;
        }
    }
    // if (["ArrowUp", "ArrowDown", "ArrowRight", "ArrowLeft", " ", "Tab"].indexOf(event.key) > -1) {
    //     event.preventDefault();
    // }
});

document.addEventListener("keyup", function (event) {
    keys[event.key] = false;
});

var mouseX = 0;
var mouseY = 0;
var mouseBoardX = -1;
var mouseBoardY = -1;

c.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});

window.addEventListener("mousemove", function(event) {
    mouseX = (event.clientX - c.getBoundingClientRect().left) * scale;
    mouseY = (event.clientY - c.getBoundingClientRect().top) * scale;
    mouseBoardX = Math.floor(((mouseX / scale) - 28) / 40);
    mouseBoardY = Math.floor(((mouseY / scale) - 28) / 40);
});

var mouseDown, mouseButton;

window.addEventListener("mousedown", function(event) {
    mouseDown = true;
    mouseButton = event.buttons;
});

window.addEventListener("mouseup", function(event) {
    mouseDown = false;
});

ctx.imageSmoothingEnabled = false;

const displayWidth = 512;
const displayHeight = 512;
const scale = 4;
c.style.width = displayWidth + 'px';
c.style.height = displayHeight + 'px';
c.width = displayWidth * scale;
c.height = displayHeight * scale;

const GAMESCREEN = {
    NULL_TO_TITLE: 0.1,
    TITLE: 1,
    TITLE_TO_LOCAL: 1.2,
    TITLE_TO_ROOM: 1.3,
    LOCAL: 2,
    ROOM: 3,
    ROOM_TO_WAIT: 3.4,
    WAIT: 4,
    WAIT_TO_ONLINE: 4.5,
    ONLINE: 5,
}

var gameScreen = GAMESCREEN.NULL_TO_TITLE;

function renderBackground() {
    ctx.fillStyle = "#220044ff";
    ctx.fillRect(0, 0, 512 * scale, 512 * scale);
}

function renderBoard() {
    ctx.fillStyle = "#7755ccff";
    ctx.fillRect(11 * scale, 11 * scale, 336 * scale, 336 * scale);
    ctx.fillStyle = "#ccaaffff";
    ctx.fillRect(19 * scale, 19 * scale, 320 * scale, 320 * scale);
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            if ((i + j) % 2 == 1) {
                ctx.fillStyle = "#eeccffff";
                ctx.fillRect((19 + (40 * i)) * scale, (19 + (40 * j)) * scale, 40 * scale, 40 * scale);
            }
        }
    }
}

const PIECETYPE = {
    KING: 0,
    QUEEN: 1,
    BISHOP: 2,
    KNIGHT: 3,
    ROOK: 4,
    PAWN: 5
};

const PIECECOLOR = {
    WHITE: 0,
    BLACK: 1
};

var selectedPiece;
var promoteMode = false;
var turn;
var hasDrawn = false;

var showProceedButton = false;

var oGameMove;

function switchTurn() {
    if (!onlineMode) {
        if (turn == PIECECOLOR.WHITE) {
            switchTurnScreenX1 = -512;
            switchTurnScreenX2 = -512;
        } else if (turn == PIECECOLOR.BLACK) {
            switchTurnScreenX1 = 512;
            switchTurnScreenX2 = 512;
        }
        transitionOut = false;
        switchTurnTimer = 0;
        switchingTurn = true;
    } else {
        update(oGameRef, {
            move: oGameMove
        });
        turn++; turn %= 2;
        showProceedButton = false;
        hasDrawn = false;
    }
}

var highlightedPieceList = [];

class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Vector4 {
    constructor(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
}

function clonePieceArray(arr) {
    var result = [];
    for (var i = 0; i < arr.length; i++) {
        result.push([]);
        for (var j = 0; j < arr.length; j++) {
            if (arr[i][j] == null) {
                result[i].push(null);
            } else {
                var p = new Piece(null, null, null);
                p.cloneFrom(arr[i][j]);
                result[i].push(p);
            }
        }
    }
    return result;
}

var whiteChecked = false;
var blackChecked = false;

class Piece {
    constructor(pos, type, col) {
        this.pos = pos;
        this.type = type;
        this.col = col;

        this.displayPos = pos;

        this.move = 0;
        if (this.type == PIECETYPE.PAWN) {
            this.canPassant = false;
        }
    }

    // clone
    cloneFrom(piece) {
        this.pos = new Vector2(piece.pos.x, piece.pos.y);
        this.type = piece.type;
        this.col = piece.col;

        this.displayPos = piece.displayPos;

        this.move = piece.move;
        if (this.type == PIECETYPE.PAWN) {
            this.canPassant = piece.canPassant;
        }
    }

    checkClick() {
        // temp, update later
        if (mouseBoardX == this.pos.x && mouseBoardY == this.pos.y) {
            if (mouseDown) {
                if (selectedPiece != this) {
                    highlightedPieceList = this.calculateSelected();

                    // save
                    var prevArray = clonePieceArray(pieceArray);
                    var prevTurn = turn;
                    var prevPos = new Vector2(this.pos.x, this.pos.y);
                    var prevMove = this.move;
                    var prevcanPassant = this.canPassant;
                    var prevWhiteChecked = whiteChecked;
                    var prevBlackChecked = blackChecked;
                    for (var i = 0; i < highlightedPieceList.length; i++) {
                        // revert
                        pieceArray = clonePieceArray(prevArray);
                        turn = prevTurn;
                        this.pos = new Vector2(prevPos.x, prevPos.y);
                        this.move = prevMove;
                        this.canPassant = prevcanPassant;
                        whiteChecked = prevWhiteChecked;
                        blackChecked = prevBlackChecked;

                        // simulate move
                        pieceArray[highlightedPieceList[i].y][highlightedPieceList[i].x] = this;
                        pieceArray[this.pos.y][this.pos.x] = null;
                        if (Object.hasOwn(highlightedPieceList[i], "z")) {
                            pieceArray[highlightedPieceList[i].w][highlightedPieceList[i].z] = null;
                        }
                        if (this.type == PIECETYPE.KING && Math.abs(highlightedPieceList[i].x - this.pos.x) == 2) {
                            if (highlightedPieceList[i].x == 2) {
                                pieceArray[highlightedPieceList[i].y][3] = pieceArray[highlightedPieceList[i].y][0];
                                pieceArray[highlightedPieceList[i].y][0] = null;
        
                                pieceArray[highlightedPieceList[i].y][3].pos.x = 3;
                                pieceArray[highlightedPieceList[i].y][3].move++;
                            }
                            if (highlightedPieceList[i].x == 6) {
                                pieceArray[highlightedPieceList[i].y][5] = pieceArray[highlightedPieceList[i].y][7];
                                pieceArray[highlightedPieceList[i].y][7] = null;
        
                                pieceArray[highlightedPieceList[i].y][5].pos.x = 3;
                                pieceArray[highlightedPieceList[i].y][5].move++;
                            }
                        }
                        for (var k = 0; k < pieceArray.length; k++) {
                            for (var j = 0; j < pieceArray[k].length; j++) {
                                if (pieceArray[k][j] != null && pieceArray[k][j].col == turn && pieceArray[k][j].type == PIECETYPE.PAWN && pieceArray[k][j].canPassant == true) {
                                    pieceArray[k][j].canPassant = false; // no longer passant-able
                                }
                            }
                        }
                        this.move++;
                        if (this.type == PIECETYPE.PAWN) {
                            if (this.canPassant == false && Math.abs(this.pos.y - highlightedPieceList[i].y) == 2) {
                                this.canPassant = true;
                            }
                        }
                        this.pos.x = highlightedPieceList[i].x;
                        this.pos.y = highlightedPieceList[i].y;
                        if (checkCheck(false)) {
                            if (turn == PIECECOLOR.WHITE) { blackChecked = true; }
                            if (turn == PIECECOLOR.BLACK) { whiteChecked = true; }
                        } else {
                            if (turn == PIECECOLOR.WHITE) { whiteChecked = false; }
                            if (turn == PIECECOLOR.BLACK) { blackChecked = false; }
                        }
                        turn++;
                        turn %= 2;

                        // remove highlighted piece if results in check
                        if (checkCheck(false)) {
                            highlightedPieceList.splice(i, 1);
                            i--;
                        }
                    }
                    // revert
                    pieceArray = clonePieceArray(prevArray);
                    turn = prevTurn;
                    this.pos = new Vector2(prevPos.x, prevPos.y);
                    this.move = prevMove;
                    this.canPassant = prevcanPassant;
                    whiteChecked = prevWhiteChecked;
                    blackChecked = prevBlackChecked;
                }
                selectedPiece = this;
            }
        }
    }

    calculateSelected() {
        var selectedList = [];
        switch (this.type) {
            case PIECETYPE.PAWN: {
                if (this.col == PIECECOLOR.WHITE) {
                    // move
                    if (this.pos.y > 0 && pieceArray[this.pos.y - 1][this.pos.x] == null) {
                        selectedList.push(new Vector2(this.pos.x, this.pos.y - 1));
                    }
                    if (this.move == 0 && this.pos.y > 1 && pieceArray[this.pos.y - 1][this.pos.x] == null && pieceArray[this.pos.y - 2][this.pos.x] == null) {
                        selectedList.push(new Vector2(this.pos.x, this.pos.y - 2));
                    }

                    // capture
                    if (this.pos.x > 0 && this.pos.y > 0 && pieceArray[this.pos.y - 1][this.pos.x - 1] != null && pieceArray[this.pos.y - 1][this.pos.x - 1].col == PIECECOLOR.BLACK) {
                        selectedList.push(new Vector2(this.pos.x - 1, this.pos.y - 1));
                    }
                    if (this.pos.x < 7 && this.pos.y > 0 && pieceArray[this.pos.y - 1][this.pos.x + 1] != null && pieceArray[this.pos.y - 1][this.pos.x + 1].col == PIECECOLOR.BLACK) {
                        selectedList.push(new Vector2(this.pos.x + 1, this.pos.y - 1));
                    }

                    // en passant
                    if (this.pos.y == 3 && this.pos.x > 0 && pieceArray[this.pos.y][this.pos.x - 1] != null && pieceArray[this.pos.y][this.pos.x - 1].type == PIECETYPE.PAWN && pieceArray[this.pos.y][this.pos.x - 1].col == PIECECOLOR.BLACK && pieceArray[this.pos.y][this.pos.x - 1].canPassant == true) {
                        selectedList.push(new Vector4(this.pos.x - 1, this.pos.y - 1, this.pos.x - 1, this.pos.y));
                    }
                    if (this.pos.y == 3 && this.pos.x < 7 && pieceArray[this.pos.y][this.pos.x + 1] != null && pieceArray[this.pos.y][this.pos.x + 1].type == PIECETYPE.PAWN && pieceArray[this.pos.y][this.pos.x + 1].col == PIECECOLOR.BLACK && pieceArray[this.pos.y][this.pos.x + 1].canPassant == true) {
                        selectedList.push(new Vector4(this.pos.x + 1, this.pos.y - 1, this.pos.x + 1, this.pos.y));
                    }
                } else if (this.col == PIECECOLOR.BLACK) {
                    // move
                    if (this.pos.y < 7 && pieceArray[this.pos.y + 1][this.pos.x] == null) {
                        selectedList.push(new Vector2(this.pos.x, this.pos.y + 1));
                    }
                    if (this.move == 0 && this.pos.y < 6 && pieceArray[this.pos.y + 1][this.pos.x] == null && pieceArray[this.pos.y + 2][this.pos.x] == null) {
                        selectedList.push(new Vector2(this.pos.x, this.pos.y + 2));
                    }

                    // capture
                    if (this.pos.x > 0 && this.pos.y < 7 && pieceArray[this.pos.y + 1][this.pos.x - 1] != null && pieceArray[this.pos.y + 1][this.pos.x - 1].col == PIECECOLOR.WHITE) {
                        selectedList.push(new Vector2(this.pos.x - 1, this.pos.y + 1));
                    }
                    if (this.pos.x < 7 && this.pos.y < 7 && pieceArray[this.pos.y + 1][this.pos.x + 1] != null && pieceArray[this.pos.y + 1][this.pos.x + 1].col == PIECECOLOR.WHITE) {
                        selectedList.push(new Vector2(this.pos.x + 1, this.pos.y + 1));
                    }

                    // en passant
                    if (this.pos.y == 4 && this.pos.x > 0 && pieceArray[this.pos.y][this.pos.x - 1] != null && pieceArray[this.pos.y][this.pos.x - 1].type == PIECETYPE.PAWN && pieceArray[this.pos.y][this.pos.x - 1].col == PIECECOLOR.WHITE && pieceArray[this.pos.y][this.pos.x - 1].canPassant == true) {
                        selectedList.push(new Vector4(this.pos.x - 1, this.pos.y + 1, this.pos.x - 1, this.pos.y));
                    }
                    if (this.pos.y == 4 && this.pos.x < 7 && pieceArray[this.pos.y][this.pos.x + 1] != null && pieceArray[this.pos.y][this.pos.x + 1].type == PIECETYPE.PAWN && pieceArray[this.pos.y][this.pos.x + 1].col == PIECECOLOR.WHITE && pieceArray[this.pos.y][this.pos.x + 1].canPassant == true) {
                        selectedList.push(new Vector4(this.pos.x + 1, this.pos.y + 1, this.pos.x + 1, this.pos.y));
                    }
                }
                break;
            }
            case PIECETYPE.KING: {
                // W
                if (this.pos.x > 0 && (pieceArray[this.pos.y][this.pos.x - 1] == null || pieceArray[this.pos.y][this.pos.x - 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x - 1, this.pos.y));
                }
                // E
                if (this.pos.x < 7 && (pieceArray[this.pos.y][this.pos.x + 1] == null || pieceArray[this.pos.y][this.pos.x + 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x + 1, this.pos.y));
                }
                // N
                if (this.pos.y > 0 && (pieceArray[this.pos.y - 1][this.pos.x] == null || pieceArray[this.pos.y - 1][this.pos.x].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x, this.pos.y - 1));
                }
                // S
                if (this.pos.y < 7 && (pieceArray[this.pos.y + 1][this.pos.x] == null || pieceArray[this.pos.y + 1][this.pos.x].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x, this.pos.y + 1));
                }
                // NW
                if (this.pos.x > 0 && this.pos.y > 0 && (pieceArray[this.pos.y - 1][this.pos.x - 1] == null || pieceArray[this.pos.y - 1][this.pos.x - 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x - 1, this.pos.y - 1));
                }
                // NE
                if (this.pos.x < 7 && this.pos.y > 0 && (pieceArray[this.pos.y - 1][this.pos.x + 1] == null || pieceArray[this.pos.y - 1][this.pos.x + 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x + 1, this.pos.y - 1));
                }
                // SW
                if (this.pos.x > 0 && this.pos.y < 7 && (pieceArray[this.pos.y + 1][this.pos.x - 1] == null || pieceArray[this.pos.y + 1][this.pos.x - 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x - 1, this.pos.y + 1));
                }
                // SE
                if (this.pos.x < 7 && this.pos.y < 7 && (pieceArray[this.pos.y + 1][this.pos.x + 1] == null || pieceArray[this.pos.y + 1][this.pos.x + 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x + 1, this.pos.y + 1));
                }

                // // castle
                // // check this & rook
                // if (this.move == 0 && pieceArray[this.pos.y][this.pos.x - 4] != null && pieceArray[this.pos.y][this.pos.x - 4].col == this.col && pieceArray[this.pos.y][this.pos.x - 4].type == PIECETYPE.ROOK && pieceArray[this.pos.y][this.pos.x - 4].move == 0) {
                //     // check between
                //     if (pieceArray[this.pos.y][this.pos.x - 3] == null && pieceArray[this.pos.y][this.pos.x - 2] == null && pieceArray[this.pos.y][this.pos.x - 1] == null) {
                //         // check selected of everyone else
                //         var a = [];
                //         for (var i = 0; i < pieceArray.length; i++) {
                //             for (var j = 0; j < pieceArray[i].length; j++) {
                //                 if (pieceArray[i][j] != null && pieceArray[i][j].type == PIECETYPE.KING && pieceArray[i][j].col != this.col && pieceArray[i][j].move == 0) {
                //                     // don't if this piece is unmoved king (prevent infinite recursion)
                //                 } else if (pieceArray[i][j] != null && pieceArray[i][j].col != this.col) {
                //                     a = a.concat(pieceArray[i][j].calculateSelected());
                //                 }
                //             }
                //         }
                //         // check if king moves through targeted square
                //         var good = true;
                //         for (var i = 0; i < a.length; i++) {
                //             if (a[i].y == this.pos.y && (a[i].x == this.pos.x - 2 || a[i].x == this.pos.x - 1 || a[i].x == this.pos.x)) {
                //                 good = false;
                //             }
                //         }
                //         if (good) {
                //             selectedList.push(new Vector2(this.pos.x - 2, this.pos.y));
                //         }
                //     }
                // }
                // if (this.move == 0 && pieceArray[this.pos.y][this.pos.x + 3] != null && pieceArray[this.pos.y][this.pos.x + 3].col == this.col && pieceArray[this.pos.y][this.pos.x + 3].type == PIECETYPE.ROOK && pieceArray[this.pos.y][this.pos.x + 3].move == 0) {
                //     // check between
                //     if (pieceArray[this.pos.y][this.pos.x + 1] == null && pieceArray[this.pos.y][this.pos.x + 2] == null) {
                //         // check selected of everyone else
                //         var a = [];
                //         for (var i = 0; i < pieceArray.length; i++) {
                //             for (var j = 0; j < pieceArray[i].length; j++) {
                //                 if (pieceArray[i][j] != null && pieceArray[i][j].type == PIECETYPE.KING && pieceArray[i][j].col != this.col && pieceArray[i][j].move == 0) {
                //                     // don't if this piece is unmoved king (prevent infinite recursion)
                //                 } else if (pieceArray[i][j] != null && pieceArray[i][j].col != this.col) {
                //                     a = a.concat(pieceArray[i][j].calculateSelected());
                //                 }
                //             }
                //         }
                //         // check if king moves through targeted square
                //         var good = true;
                //         for (var i = 0; i < a.length; i++) {
                //             if (a[i].y == this.pos.y && (a[i].x == this.pos.x || a[i].x == this.pos.x + 1 || a[i].x == this.pos.x + 2)) {
                //                 good = false;
                //             }
                //         }
                //         if (good) {
                //             selectedList.push(new Vector2(this.pos.x + 2, this.pos.y));
                //         }
                //     }
                // }
                break;
            }
            case PIECETYPE.KNIGHT: {
                // right 2, up 1
                if (this.pos.x < 6 && this.pos.y > 0 && (pieceArray[this.pos.y - 1][this.pos.x + 2] == null || pieceArray[this.pos.y - 1][this.pos.x + 2].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x + 2, this.pos.y - 1));
                }
                // right 2, down 1
                if (this.pos.x < 6 && this.pos.y < 7 && (pieceArray[this.pos.y + 1][this.pos.x + 2] == null || pieceArray[this.pos.y + 1][this.pos.x + 2].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x + 2, this.pos.y + 1));
                }
                // left 2, up 1
                if (this.pos.x > 1 && this.pos.y > 0 && (pieceArray[this.pos.y - 1][this.pos.x - 2] == null || pieceArray[this.pos.y - 1][this.pos.x - 2].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x - 2, this.pos.y - 1));
                }
                // left 2, down 1
                if (this.pos.x > 1 && this.pos.y < 7 && (pieceArray[this.pos.y + 1][this.pos.x - 2] == null || pieceArray[this.pos.y + 1][this.pos.x - 2].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x - 2, this.pos.y + 1));
                }
                // right 1, up 2
                if (this.pos.x < 7 && this.pos.y > 1 && (pieceArray[this.pos.y - 2][this.pos.x + 1] == null || pieceArray[this.pos.y - 2][this.pos.x + 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x + 1, this.pos.y - 2));
                }
                // right 1, down 2
                if (this.pos.x < 7 && this.pos.y < 6 && (pieceArray[this.pos.y + 2][this.pos.x + 1] == null || pieceArray[this.pos.y + 2][this.pos.x + 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x + 1, this.pos.y + 2));
                }
                // left 1, up 2
                if (this.pos.x > 0 && this.pos.y > 1 && (pieceArray[this.pos.y - 2][this.pos.x - 1] == null || pieceArray[this.pos.y - 2][this.pos.x - 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x - 1, this.pos.y - 2));
                }
                // left 1, down 2
                if (this.pos.x > 0 && this.pos.y < 6 && (pieceArray[this.pos.y + 2][this.pos.x - 1] == null || pieceArray[this.pos.y + 2][this.pos.x - 1].col != this.col)) {
                    selectedList.push(new Vector2(this.pos.x - 1, this.pos.y + 2));
                }
                break;
            }
            case PIECETYPE.QUEEN:
            case PIECETYPE.ROOK: {
                // left
                for (var i = 1; i < 8; i++) {
                    if (this.pos.x + i <= 7 && (pieceArray[this.pos.y][this.pos.x + i] == null || pieceArray[this.pos.y][this.pos.x + i].col != this.col)) {
                        selectedList.push(new Vector2(this.pos.x + i, this.pos.y));
                        if (pieceArray[this.pos.y][this.pos.x + i] != null) { break; }
                    } else {
                        break;
                    }
                }
                // right
                for (var i = 1; i < 8; i++) {
                    if (this.pos.x - i >= 0 && (pieceArray[this.pos.y][this.pos.x - i] == null || pieceArray[this.pos.y][this.pos.x - i].col != this.col)) {
                        selectedList.push(new Vector2(this.pos.x - i, this.pos.y));
                        if (pieceArray[this.pos.y][this.pos.x - i] != null) { break; }
                    } else {
                        break;
                    }
                }
                // down
                for (var i = 1; i < 8; i++) {
                    if (this.pos.y + i <= 7 && (pieceArray[this.pos.y + i][this.pos.x] == null || pieceArray[this.pos.y + i][this.pos.x].col != this.col)) {
                        selectedList.push(new Vector2(this.pos.x, this.pos.y + i));
                        if (pieceArray[this.pos.y + i][this.pos.x] != null) { break; }
                    } else {
                        break;
                    }
                }
                // up
                for (var i = 1; i < 8; i++) {
                    if (this.pos.y - i >= 0 && (pieceArray[this.pos.y - i][this.pos.x] == null || pieceArray[this.pos.y - i][this.pos.x].col != this.col)) {
                        selectedList.push(new Vector2(this.pos.x, this.pos.y - i));
                        if (pieceArray[this.pos.y - i][this.pos.x] != null) { break; }
                    } else {
                        break;
                    }
                }
                // no break statement so queen can fallthrough to bishop
            }
            case PIECETYPE.BISHOP: {
                // break statement to keep rook from fallthrough
                if (this.type == PIECETYPE.ROOK) { break; }
                // NW
                for (var i = 1; i < 8; i++) {
                    if (this.pos.x - i >= 0 && this.pos.y - i >= 0 && (pieceArray[this.pos.y - i][this.pos.x - i] == null || pieceArray[this.pos.y - i][this.pos.x - i].col != this.col)) {
                        selectedList.push(new Vector2(this.pos.x - i, this.pos.y - i));
                        if (pieceArray[this.pos.y - i][this.pos.x - i] != null) { break; }
                    } else {
                        break;
                    }
                }
                // NE
                for (var i = 1; i < 8; i++) {
                    if (this.pos.x + i <= 7 && this.pos.y - i >= 0 && (pieceArray[this.pos.y - i][this.pos.x + i] == null || pieceArray[this.pos.y - i][this.pos.x + i].col != this.col)) {
                        selectedList.push(new Vector2(this.pos.x + i, this.pos.y - i));
                        if (pieceArray[this.pos.y - i][this.pos.x + i] != null) { break; }
                    } else {
                        break;
                    }
                }
                // SW
                for (var i = 1; i < 8; i++) {
                    if (this.pos.x - i >= 0 && this.pos.y + i <= 7 && (pieceArray[this.pos.y + i][this.pos.x - i] == null || pieceArray[this.pos.y + i][this.pos.x - i].col != this.col)) {
                        selectedList.push(new Vector2(this.pos.x - i, this.pos.y + i));
                        if (pieceArray[this.pos.y + i][this.pos.x - i] != null) { break; }
                    } else {
                        break;
                    }
                }
                // SE
                for (var i = 1; i < 8; i++) {
                    if (this.pos.x + i <= 7 && this.pos.y + i <= 7 && (pieceArray[this.pos.y + i][this.pos.x + i] == null || pieceArray[this.pos.y + i][this.pos.x + i].col != this.col)) {
                        selectedList.push(new Vector2(this.pos.x + i, this.pos.y + i));
                        if (pieceArray[this.pos.y + i][this.pos.x + i] != null) { break; }
                    } else {
                        break;
                    }
                }
                break;
            }
        }
        return selectedList;
    }

    render() {
        ctx.drawImage(spritesheet, 427 * this.type, 427 * this.col, 427, 427, (19 + this.displayPos.x * 40) * scale, (19 + this.displayPos.y * 40) * scale, 40 * scale, 40 * scale);
        this.displayPos.x += ((this.pos.x - this.displayPos.x) / 15) * deltaTime;
        this.displayPos.y += ((this.pos.y - this.displayPos.y) / 15) * deltaTime;
    }
}

var pieceArray = [[null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null]];

function initPieces() {
    pieceArray[0][0] = new Piece(new Vector2(0, 0), PIECETYPE.ROOK, PIECECOLOR.BLACK);
    pieceArray[0][1] = new Piece(new Vector2(1, 0), PIECETYPE.KNIGHT, PIECECOLOR.BLACK);
    pieceArray[0][2] = new Piece(new Vector2(2, 0), PIECETYPE.BISHOP, PIECECOLOR.BLACK);
    pieceArray[0][3] = new Piece(new Vector2(3, 0), PIECETYPE.QUEEN, PIECECOLOR.BLACK);
    pieceArray[0][4] = new Piece(new Vector2(4, 0), PIECETYPE.KING, PIECECOLOR.BLACK);
    pieceArray[0][5] = new Piece(new Vector2(5, 0), PIECETYPE.BISHOP, PIECECOLOR.BLACK);
    pieceArray[0][6] = new Piece(new Vector2(6, 0), PIECETYPE.KNIGHT, PIECECOLOR.BLACK);
    pieceArray[0][7] = new Piece(new Vector2(7, 0), PIECETYPE.ROOK, PIECECOLOR.BLACK);
    for (var i = 0; i < 8; i++) {
        pieceArray[1][i] = new Piece(new Vector2(i, 1), PIECETYPE.PAWN, PIECECOLOR.BLACK);
    }

    pieceArray[7][0] = new Piece(new Vector2(0, 7), PIECETYPE.ROOK, PIECECOLOR.WHITE);
    pieceArray[7][1] = new Piece(new Vector2(1, 7), PIECETYPE.KNIGHT, PIECECOLOR.WHITE);
    pieceArray[7][2] = new Piece(new Vector2(2, 7), PIECETYPE.BISHOP, PIECECOLOR.WHITE);
    pieceArray[7][3] = new Piece(new Vector2(3, 7), PIECETYPE.QUEEN, PIECECOLOR.WHITE);
    pieceArray[7][4] = new Piece(new Vector2(4, 7), PIECETYPE.KING, PIECECOLOR.WHITE);
    pieceArray[7][5] = new Piece(new Vector2(5, 7), PIECETYPE.BISHOP, PIECECOLOR.WHITE);
    pieceArray[7][6] = new Piece(new Vector2(6, 7), PIECETYPE.KNIGHT, PIECECOLOR.WHITE);
    pieceArray[7][7] = new Piece(new Vector2(7, 7), PIECETYPE.ROOK, PIECECOLOR.WHITE);
    for (var i = 0; i < 8; i++) {
        pieceArray[6][i] = new Piece(new Vector2(i, 6), PIECETYPE.PAWN, PIECECOLOR.WHITE);
    }
}


function renderPieces() {
    for (var i = 0; i < pieceArray.length; i++) {
        for (var j = 0; j < pieceArray[i].length; j++) {
            if (pieceArray[i][j] != null) {
                pieceArray[i][j].render();
            }
        }
    }
}

function renderHighlightedPieces() {
    // deselect
    if (keys["Escape"]) {
        selectedPiece = null;
        highlightedPieceList = [];
    }
    for (var i = 0; i < highlightedPieceList.length; i++) {
        ctx.beginPath();
        ctx.fillStyle = "#00ff0080";
        ctx.fillRect((19 + highlightedPieceList[i].x * 40) * scale, (19 + highlightedPieceList[i].y * 40) * scale, 40 * scale, 40 * scale);
    }
}

function renderHoverHighlight() {
    if (mouseBoardX >= 0 && mouseBoardX <= 7 && mouseBoardY >= 0 && mouseBoardY <= 7) {
        ctx.beginPath();
        ctx.fillStyle = "#aa88ff40";
        ctx.fillRect((19 + mouseBoardX * 40) * scale, (19 + mouseBoardY * 40) * scale, 40 * scale, 40 * scale);
    }
}

var promoteRenderBannerWidth = 0;
function renderPromoteSelect() {
    ctx.beginPath();
    ctx.fillStyle = "#00000080";
    ctx.fillRect(0, 0, 512 * scale, 512 * scale);

    ctx.beginPath();
    ctx.fillStyle = "#6644bbff";
    ctx.fillRect(0, 192 * scale, promoteRenderBannerWidth * 512 * scale, 128 * scale);

    ctx.beginPath();
    ctx.drawImage(spritesheet, 427 * PIECETYPE.QUEEN, 427 * turn, 427, 427, (-40 + 102) * scale * promoteRenderBannerWidth, 200 * scale, 80 * scale, 80 * scale);
    ctx.drawImage(spritesheet, 427 * PIECETYPE.ROOK, 427 * turn, 427, 427, (-40 + 204) * scale * promoteRenderBannerWidth, 200 * scale, 80 * scale, 80 * scale);
    ctx.drawImage(spritesheet, 427 * PIECETYPE.BISHOP, 427 * turn, 427, 427, (-40 + 306) * scale * promoteRenderBannerWidth, 200 * scale, 80 * scale, 80 * scale);
    ctx.drawImage(spritesheet, 427 * PIECETYPE.KNIGHT, 427 * turn, 427, 427, (-40 + 408) * scale * promoteRenderBannerWidth, 200 * scale, 80 * scale, 80 * scale);

    ctx.beginPath();
    ctx.fillStyle = "#ffffffff";
    ctx.font = (String)(10 * scale) + "px Arial";
    ctx.fillText("Press key:", 5 * scale * promoteRenderBannerWidth, 205 * scale);

    ctx.beginPath();
    ctx.fillStyle = "#ffffffff";
    ctx.font = (String)(25 * scale) + "px Arial";
    ctx.fillText("Q", 92 * scale * promoteRenderBannerWidth, 300 * scale);
    ctx.fillText("R", 195 * scale * promoteRenderBannerWidth, 300 * scale);
    ctx.fillText("B", 297 * scale * promoteRenderBannerWidth, 300 * scale);
    ctx.fillText("N", 400 * scale * promoteRenderBannerWidth, 300 * scale);
}

const CARDSIDE = {
    FRONT: 0,
    BACK: 1
}

class Card {
    constructor(x, y, type, col) {
        this.unscaledPos = new Vector2(x, y);
        this.pos = new Vector2(x, y);
        this.size = 1;
        this.type = type;
        this.col = col;
    }

    render(side) {
        this.pos.x = this.unscaledPos.x / this.size;
        this.pos.y = this.unscaledPos.y / this.size;

        if (side == CARDSIDE.FRONT) {
            // checkers
            ctx.beginPath();
            ctx.fillStyle = "#eeccffff";
            for (var i = 0; i < 7; i++) {
                for (var j = 0; j < 12; j++) {
                    if ((i + j) % 2 == 0) {
                        ctx.fillStyle = "#eeccffff";
                        ctx.fillRect((this.pos.x - 46 + ((92/7) * i)) * this.size * scale, (this.pos.y - 76 + ((92/7) * j)) * this.size * scale, this.size * (92/7) * scale, this.size * (92/7) * scale);
                    } else {
                        ctx.fillStyle = "#ccaaffff";
                        ctx.fillRect((this.pos.x - 46 + ((92/7) * i)) * this.size * scale, (this.pos.y - 76 + ((92/7) * j)) * this.size * scale, this.size * (92/7) * scale, this.size * (92/7) * scale);
                    }
                }
            }

            // border
            ctx.beginPath();
            ctx.strokeStyle = "#552288ff";
            ctx.lineWidth = this.size * 8 * scale;
            ctx.roundRect((this.pos.x - 50) * this.size * scale, (this.pos.y - 80) * this.size * scale, this.size * 100 * scale, this.size * 160 * scale, this.size * 10 * scale);
            ctx.stroke();

            // piece
            ctx.drawImage(spritesheet, 427 * this.type, 427 * this.col, 427, 427, (this.pos.x - 45) * this.size * scale, (this.pos.y - 25) * this.size * scale, this.size * 90 * scale, this.size * 90 * scale);

            // text
            ctx.beginPath();
            ctx.fillStyle = "#552288ff";
            ctx.font = (String)(30 * this.size * scale) + "px Brush Script MT";
            switch(this.type) {
                case PIECETYPE.PAWN: {
                    ctx.fillText("Pawn", (this.pos.x - 1 - (ctx.measureText("Pawn").width / (2 * this.size * scale))) * this.size * scale, (this.pos.y - 35) * this.size * scale);
                    break
                }
                case PIECETYPE.ROOK: {
                    ctx.fillText("Rook", (this.pos.x - 1 - (ctx.measureText("Rook").width / (2 * this.size * scale))) * this.size * scale, (this.pos.y - 35) * this.size * scale);
                    break
                }
                case PIECETYPE.BISHOP: {
                    ctx.fillText("Bishop", (this.pos.x - 1 - (ctx.measureText("Bishop").width / (2 * this.size * scale))) * this.size * scale, (this.pos.y - 35) * this.size * scale);
                    break
                }
                case PIECETYPE.KNIGHT: {
                    ctx.fillText("Knight", (this.pos.x - 1 - (ctx.measureText("Knight").width / (2 * this.size * scale))) * this.size * scale, (this.pos.y - 35) * this.size * scale);
                    break
                }
                case PIECETYPE.QUEEN: {
                    ctx.fillText("Queen", (this.pos.x - 1 - (ctx.measureText("Queen").width / (2 * this.size * scale))) * this.size * scale, (this.pos.y - 35) * this.size * scale);
                    break
                }
                case PIECETYPE.KING: {
                    ctx.fillText("King", (this.pos.x - 1 - (ctx.measureText("King").width / (2 * this.size * scale))) * this.size * scale, (this.pos.y - 35) * this.size * scale);
                    break
                }
            }
        } else if (side == CARDSIDE.BACK) {
            // card back
            ctx.beginPath();
            ctx.fillStyle = "#7744aaff";
            ctx.strokeStyle = "#552288ff";
            ctx.lineWidth = this.size * 8 * scale;
            ctx.roundRect((this.pos.x - 50) * this.size * scale, (this.pos.y - 80) * this.size * scale, this.size * 100 * scale, this.size * 160 * scale, this.size * 10 * scale);
            ctx.fill();
            ctx.stroke();

            // stripes
            ctx.beginPath();
            ctx.fillStyle = "#6633aaff";
            ctx.fillRect((this.pos.x - 46) * this.size * scale, (this.pos.y - 66) * this.size * scale, this.size * 92 * scale, this.size * 10 * scale);
            ctx.fillRect((this.pos.x - 46) * this.size * scale, (this.pos.y - 46) * this.size * scale, this.size * 92 * scale, this.size * 10 * scale);
            ctx.fillRect((this.pos.x - 46) * this.size * scale, (this.pos.y - 26) * this.size * scale, this.size * 92 * scale, this.size * 10 * scale);
            ctx.fillRect((this.pos.x - 46) * this.size * scale, (this.pos.y - 6) * this.size * scale, this.size * 92 * scale, this.size * 10 * scale);
            ctx.fillRect((this.pos.x - 46) * this.size * scale, (this.pos.y + 14) * this.size * scale, this.size * 92 * scale, this.size * 10 * scale);
            ctx.fillRect((this.pos.x - 46) * this.size * scale, (this.pos.y + 34) * this.size * scale, this.size * 92 * scale, this.size * 10 * scale);
            ctx.fillRect((this.pos.x - 46) * this.size * scale, (this.pos.y + 54) * this.size * scale, this.size * 92 * scale, this.size * 10 * scale);

            // bottom king
            ctx.translate((this.pos.x - 30) * this.size * scale, (this.pos.y - 56) * this.size * scale);
            ctx.scale(1, -1);
            ctx.rotate(-0.2);
            ctx.translate(-(this.pos.x - 30) * this.size * scale, -(this.pos.y - 56) * this.size * scale);

            ctx.drawImage(spritesheet, 427 * PIECETYPE.KING, 427 * PIECECOLOR.WHITE, 427, 427, (this.pos.x - 25) * this.size * scale, (this.pos.y - 171) * this.size * scale, this.size * 70 * scale, this.size * 70 * scale);

            ctx.translate((this.pos.x - 30) * this.size * scale, (this.pos.y - 56) * this.size * scale);
            ctx.rotate(0.2);
            ctx.scale(1, -1);
            ctx.translate(-(this.pos.x - 30) * this.size * scale, -(this.pos.y - 56) * this.size * scale);

            // top king
            ctx.translate((this.pos.x - 30) * this.size * scale, (this.pos.y - 56) * this.size * scale);
            ctx.rotate(0.2);
            ctx.translate(-(this.pos.x - 30) * this.size * scale, -(this.pos.y - 56) * this.size * scale);

            ctx.drawImage(spritesheet, 427 * PIECETYPE.KING, 427 * PIECECOLOR.BLACK, 427, 427, (this.pos.x - 25) * this.size * scale, (this.pos.y + -71) * this.size * scale, this.size * 70 * scale, this.size * 70 * scale);

            ctx.translate((this.pos.x - 30) * this.size * scale, (this.pos.y - 56) * this.size * scale);
            ctx.rotate(-0.2);
            ctx.translate(-(this.pos.x - 30) * this.size * scale, -(this.pos.y - 56) * this.size * scale);
        }
    }
}

var whiteCardList = [];
var whiteKingDrawn = false;
var blackCardList = [];
var blackKingDrawn = false;

var switchingTurn = false;

function randomCard() {
    var c = Math.random();
    if (c < (8 / 15)) {
        return PIECETYPE.PAWN;
    } else if (c < (10 / 15)) {
        return PIECETYPE.ROOK;
    } else if (c < (12 / 15)) {
        return PIECETYPE.BISHOP;
    } else if (c < (14 / 15)) {
        return PIECETYPE.KNIGHT;
    } else {
        return PIECETYPE.QUEEN;
    }
}

var drawingCard = false;
var placingCard = false;
var placeCard;
var placePiece;
var drawCardTimer = 0;
var placeCardTimer = 0;

var backgroundCard = new Card(425, 179, null, null); // background card, only for rendering
var hoverCard = new Card(425, 179, null, null);
var drawCard;
function renderDrawPile() {
    backgroundCard.render(CARDSIDE.BACK);
    hoverCard.render(CARDSIDE.BACK);

    if ((((!onlineMode && turn == PIECECOLOR.WHITE) || (onlineMode && oSelfCol == turn && turn == PIECECOLOR.WHITE)) && whiteCardList.length > 15) || (((!onlineMode && turn == PIECECOLOR.BLACK) || (onlineMode && oSelfCol == turn && turn == PIECECOLOR.BLACK)) && blackCardList.length > 15)) { hasDrawn = true; }

    if ((!onlineMode || (onlineMode && oSelfCol == turn)) && !showProceedButton && !switchingTurn && !drawingCard && !hasDrawn && mouseX > 375 * scale && mouseX < 475 * scale && mouseY > 99 * scale && mouseY < 259 * scale) {
        if (mouseDown) {
            drawingCard = true;
            drawCardTimer = 0;
            hoverCard.unscaledPos.y = 179;
            if ((turn == PIECECOLOR.WHITE && !whiteKingDrawn) || (turn == PIECECOLOR.BLACK && !blackKingDrawn)) {
                drawCard = new Card(425, 167, PIECETYPE.KING, turn);
                if (turn == PIECECOLOR.WHITE) { whiteKingDrawn = true };
                if (turn == PIECECOLOR.BLACK) { blackKingDrawn = true };
            } else {
                drawCard = new Card(425, 167, randomCard(), turn);
            }
        }
        hoverCard.unscaledPos.y += ((167 - hoverCard.unscaledPos.y) / 15) * deltaTime;
    } else {
        hoverCard.unscaledPos.y += ((179 - hoverCard.unscaledPos.y) / 15) * deltaTime;
    }
}

function renderDrawCard() {
    if (drawCardTimer < 200) {
        ctx.beginPath();
        ctx.fillStyle = "#00000080";
        ctx.fillRect(0, 0, 512 * scale, 512 * scale);

        drawCard.render(CARDSIDE.BACK);

        drawCard.unscaledPos.x += ((256 - drawCard.unscaledPos.x) / 15) * deltaTime;
        drawCard.unscaledPos.y += ((256 - drawCard.unscaledPos.y) / 15) * deltaTime;
        drawCard.size += ((1.5 - drawCard.size) / 15) * deltaTime;
    } else if (drawCardTimer < 350) {
        drawCard.render(CARDSIDE.FRONT);

        drawCard.unscaledPos.x += ((256 - drawCard.unscaledPos.x) / 15) * deltaTime;
        drawCard.size += ((1.7 - drawCard.size) / 15) * deltaTime;
    } else {
        if (turn == PIECECOLOR.WHITE) {
            whiteCardList.push(new Card(999, 480, drawCard.type, turn));
        } else if (turn == PIECECOLOR.BLACK) {
            blackCardList.push(new Card(999, 480, drawCard.type, turn));
        }
        drawingCard = false;
        hasDrawn = true;
    }
}

function renderPlaceCard() {
    if (placeCardTimer < 150) {
        ctx.beginPath();
        ctx.fillStyle = "#00000080";
        ctx.fillRect(0, 0, 512 * scale, 512 * scale);

        placeCard.render(CARDSIDE.FRONT);

        placeCard.unscaledPos.x += ((256 - placeCard.unscaledPos.x) / 15) * deltaTime;
        placeCard.unscaledPos.y += ((256 - placeCard.unscaledPos.y) / 15) * deltaTime;
        placeCard.size += ((1.5 - placeCard.size) / 15) * deltaTime;
    } else {
        if (placePiece == null) {
            placePiece = new Piece(new Vector2(mouseBoardX, mouseBoardY), placeCard.type, placeCard.col);
        }
        placePiece.pos.x = mouseBoardX;
        placePiece.pos.y = mouseBoardY;
        if (mouseBoardX >= 0 && mouseBoardX <= 7 && ((turn == PIECECOLOR.BLACK && (mouseBoardY == 0 || mouseBoardY == 1)) || (turn == PIECECOLOR.WHITE && (mouseBoardY == 6 || mouseBoardY == 7)))) {
            if (pieceArray[mouseBoardY][mouseBoardX] == null) {
                pieceArray[mouseBoardY][mouseBoardX] = placePiece;
                if (!checkCheck(true)) {
                    pieceArray[mouseBoardY][mouseBoardX] = null;
                    placePiece.render();
                    if (mouseDown) {
                        // move to info (x, y, type, col, passantable)
                        if (placePiece.type == PIECETYPE.PAWN) {
                            oGameMove = String(mouseBoardX)+","+String(mouseBoardY)+","+String(placePiece.type)+","+String(placePiece.col)+","+String(placePiece.canPassant);
                        } else {
                            oGameMove = String(mouseBoardX)+","+String(mouseBoardY)+","+String(placePiece.type)+","+String(placePiece.col)+",false";
                        }
                        pieceArray[mouseBoardY][mouseBoardX] = placePiece;
                        placePiece = null;
                        placeCard = null;
                        placingCard = false;
                        showProceedButton = true;
                        highlightedPieceList = [];
                        selectedPiece = null;
                    }
                } else {
                    pieceArray[mouseBoardY][mouseBoardX] = null;
                }
            }
        }

        // deselect
        if (keys["Escape"] && !showProceedButton) {
            placeCard.unscaledPos.x = 999;
            placeCard.unscaledPos.y = 480;
            placeCard.size = 1;
            if (placeCard.col == PIECECOLOR.WHITE) { whiteCardList.push(placeCard); }
            else if (placeCard.col == PIECECOLOR.BLACK) { blackCardList.push(placeCard); }
            placePiece = null;
            placeCard = null;
            placingCard = false;
            highlightedPieceList = [];
            selectedPiece = null;
        }
    }
}

function cardCannotEscapeCheck(type, col) {
    if (col == PIECECOLOR.WHITE) {
        for (var i = 6; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                if (pieceArray[i][j] == null) {
                    pieceArray[i][j] = new Piece(new Vector2(j, i), type, PIECECOLOR.WHITE);
                    if (!checkCheck(true)) {
                        pieceArray[i][j] = null;
                        return false;
                    }
                    pieceArray[i][j] = null;
                }
            }
        }
        return true;
    } else if (col == PIECECOLOR.BLACK) {
        for (var i = 0; i < 2; i++) {
            for (var j = 0; j < 8; j++) {
                if (pieceArray[i][j] == null) {
                    pieceArray[i][j] = new Piece(new Vector2(j, i), type, PIECECOLOR.BLACK);
                    if (!checkCheck(true)) {
                        pieceArray[i][j] = null;
                        return false;
                    }
                    pieceArray[i][j] = null;
                }
            }
        }
        return true;
    }
}

function renderDeck() {
    if ((!onlineMode && turn == PIECECOLOR.WHITE) || (onlineMode && oSelfCol == PIECECOLOR.WHITE)) {
        for (var i = 0; i < whiteCardList.length; i++) {
            // raise on hover
            if (i == whiteCardList.length - 1) {
                if (turn == PIECECOLOR.WHITE && !cardCannotEscapeCheck(whiteCardList[i].type, PIECECOLOR.WHITE) && !showProceedButton && !switchingTurn && !promoteMode && !drawingCard && !placingCard && hasDrawn && (mouseX / scale) > (whiteCardList[i].unscaledPos.x - 50) && (mouseX / scale) < (whiteCardList[i].unscaledPos.x + 50) && (mouseY / scale) > 400) {
                    if (mouseDown) {
                        placingCard = true;
                        highlightedPieceList = [];
                        placeCardTimer = 0;
                        placeCard = whiteCardList[i];
                        whiteCardList.splice(i, 1);
                        break;
                    }
                    whiteCardList[i].unscaledPos.y += ((430 - whiteCardList[i].unscaledPos.y) / 15) * deltaTime;
                } else {
                    whiteCardList[i].unscaledPos.y += ((480 - whiteCardList[i].unscaledPos.y) / 15) * deltaTime;
                }
            } else {
                if (turn == PIECECOLOR.WHITE && !cardCannotEscapeCheck(whiteCardList[i].type, PIECECOLOR.WHITE) && !showProceedButton && !switchingTurn && !promoteMode && !drawingCard && !placingCard && hasDrawn && (mouseX / scale) > (whiteCardList[i].unscaledPos.x - 50) && (mouseX / scale) < (whiteCardList[i + 1].unscaledPos.x - 50) && (mouseY / scale) > 400) {
                    if (mouseDown) {
                        placingCard = true;
                        highlightedPieceList = [];
                        placeCardTimer = 0;
                        placeCard = whiteCardList[i];
                        whiteCardList.splice(i, 1);
                        break;
                    }
                    whiteCardList[i].unscaledPos.y += ((430 - whiteCardList[i].unscaledPos.y) / 15) * deltaTime;
                } else {
                    whiteCardList[i].unscaledPos.y += ((480 - whiteCardList[i].unscaledPos.y) / 15) * deltaTime;
                }
            }
            // slide in to positino
            if (whiteCardList.length > 5) {
                whiteCardList[i].unscaledPos.x += ((256 + ((450 / whiteCardList.length) * (i - ((whiteCardList.length - 1) / 2))) - whiteCardList[i].unscaledPos.x) / 15) * deltaTime;
            } else {
                whiteCardList[i].unscaledPos.x += ((256 + (90 * (i - ((whiteCardList.length - 1) / 2))) - whiteCardList[i].unscaledPos.x) / 15) * deltaTime;
            }
            whiteCardList[i].render(CARDSIDE.FRONT);
        }
    } else if ((!onlineMode && turn == PIECECOLOR.BLACK) || (onlineMode && oSelfCol == PIECECOLOR.BLACK)) {
        for (var i = 0; i < blackCardList.length; i++) {
            // raise on hover
            if (i == blackCardList.length - 1) {
                if (turn == PIECECOLOR.BLACK && !cardCannotEscapeCheck(blackCardList[i].type, PIECECOLOR.BLACK) && !showProceedButton && !switchingTurn && !promoteMode && !drawingCard && !placingCard && hasDrawn && (mouseX / scale) > (blackCardList[i].unscaledPos.x - 50) && (mouseX / scale) < (blackCardList[i].unscaledPos.x + 50) && (mouseY / scale) > 400) {
                    if (mouseDown) {
                        placingCard = true;
                        highlightedPieceList = [];
                        placeCardTimer = 0;
                        placeCard = blackCardList[i];
                        blackCardList.splice(i, 1);
                        break;
                    }
                    blackCardList[i].unscaledPos.y += ((430 - blackCardList[i].unscaledPos.y) / 15) * deltaTime;
                } else {
                    blackCardList[i].unscaledPos.y += ((480 - blackCardList[i].unscaledPos.y) / 15) * deltaTime;
                }
            } else {
                if (turn == PIECECOLOR.BLACK && !cardCannotEscapeCheck(blackCardList[i].type, PIECECOLOR.BLACK) && !showProceedButton && !switchingTurn && !promoteMode && !drawingCard && !placingCard && hasDrawn && (mouseX / scale) > (blackCardList[i].unscaledPos.x - 50) && (mouseX / scale) < (blackCardList[i + 1].unscaledPos.x - 50) && (mouseY / scale) > 400) {
                    if (mouseDown) {
                        placingCard = true;
                        highlightedPieceList = [];
                        placeCardTimer = 0;
                        placeCard = blackCardList[i];
                        blackCardList.splice(i, 1);
                        break;
                    }
                    blackCardList[i].unscaledPos.y += ((430 - blackCardList[i].unscaledPos.y) / 15) * deltaTime;
                } else {
                    blackCardList[i].unscaledPos.y += ((480 - blackCardList[i].unscaledPos.y) / 15) * deltaTime;
                }
            }
            // slide in to position
            if (blackCardList.length > 5) {
                blackCardList[i].unscaledPos.x += ((256 + ((450 / blackCardList.length) * (i - ((blackCardList.length - 1) / 2))) - blackCardList[i].unscaledPos.x) / 15) * deltaTime;
            } else {
                blackCardList[i].unscaledPos.x += ((256 + (90 * (i - ((blackCardList.length - 1) / 2))) - blackCardList[i].unscaledPos.x) / 15) * deltaTime;
            }
            blackCardList[i].render(CARDSIDE.FRONT);
        }
    }
}

function renderBoardDeckOverlay() {
    if (!hasDrawn || (onlineMode && turn != oSelfCol)) {
        ctx.beginPath();
        ctx.fillStyle = "#00000080";
        ctx.fillRect(0, 274 * scale, 512 * scale, 238 * scale);
        ctx.fillRect(0, 0, 360 * scale, 274 * scale);
        ctx.fillRect(492 * scale, 0, 20 * scale, 384 * scale);
        ctx.fillRect(360 * scale, 0, 132 * scale, 70 * scale);
    }
}

function renderDrawPileOverlay() {
    if (hasDrawn || (onlineMode && turn != oSelfCol)) {
        ctx.beginPath();
        ctx.fillStyle = "#00000080";
        ctx.fillRect(360 * scale, 70 * scale, 132 * scale, 214 * scale);
    }
}

function renderOpponentCardCount() {
    ctx.beginPath();
    ctx.fillStyle = "#ffffffff";
    ctx.font = String(15 * scale) + "px Arial";
    if (whiteCardList.length == 1) {
        ctx.fillText("White has 1 card.", 360 * scale, 25 * scale);
    } else {
        ctx.fillText("White has " + String(whiteCardList.length) + " cards.", 360 * scale, 25 * scale);
    }
    if (blackCardList.length == 1) {
        ctx.fillText("Black has 1 card.", 360 * scale, 45 * scale);
    } else {
        ctx.fillText("Black has " + String(blackCardList.length) + " cards.", 360 * scale, 45 * scale);
    }
    if (turn == PIECECOLOR.WHITE) {
        ctx.fillText("White to move.", 360 * scale, 65 * scale);
    } else if (turn == PIECECOLOR.BLACK) {
        ctx.fillText("Black to move.", 360 * scale, 65 * scale);
    }
}

var switchTurnScreenX1 = -512;
var switchTurnScreenX2 = -512;
var switchTurnTimer = 0;
var transitionOut = false;
function renderSwitchTurn() {
    ctx.beginPath();

    ctx.fillStyle = "#552288ff";
    ctx.fillRect(switchTurnScreenX1 * scale, 0 * scale, 512 * scale, 64 * scale);
    ctx.fillRect(switchTurnScreenX1 * scale, 128 * scale, 512 * scale, 64 * scale);
    ctx.fillRect(switchTurnScreenX1 * scale, 256 * scale, 512 * scale, 64 * scale);
    ctx.fillRect(switchTurnScreenX1 * scale, 384 * scale, 512 * scale, 64 * scale);
    ctx.fillStyle = "#7744aaff";
    ctx.fillStyle = "#6633aaff";
    ctx.fillRect(switchTurnScreenX2 * scale, 64 * scale, 512 * scale, 64 * scale);
    ctx.fillRect(switchTurnScreenX2 * scale, 192 * scale, 512 * scale, 64 * scale);
    ctx.fillRect(switchTurnScreenX2 * scale, 320 * scale, 512 * scale, 64 * scale);
    ctx.fillRect(switchTurnScreenX2 * scale, 448 * scale, 512 * scale, 64 * scale);

    if (!transitionOut) {
        ctx.beginPath();
        ctx.fillStyle = "#ffffffff";
        ctx.font = String(50 * scale) + "px Arial";
        ctx.fillText("Switching Turn", (85 + switchTurnScreenX1) * scale, 80 * scale);
        if (turn == PIECECOLOR.WHITE) {
            ctx.fillText("To Black", (150 + switchTurnScreenX1) * scale, 160 * scale);
        }
        if (turn == PIECECOLOR.BLACK) {
            ctx.fillText("To White", (150 + switchTurnScreenX1) * scale, 160 * scale);
        }
        ctx.font = String(30 * scale) + "px Arial";
        ctx.fillText("Press Enter to Confirm", (95 + switchTurnScreenX1) * scale, 320 * scale);

        if (turn == PIECECOLOR.WHITE) {
            switchTurnScreenX1 += ((0 - switchTurnScreenX1) / 20) * deltaTime;
            if (switchTurnTimer > 10) {
                switchTurnScreenX2 += ((0 - switchTurnScreenX2) / 20) * deltaTime;
            }
        } else if (turn == PIECECOLOR.BLACK) {
            switchTurnScreenX1 += ((0 - switchTurnScreenX1) / 20) * deltaTime;
            if (switchTurnTimer > 10) {
                switchTurnScreenX2 += ((0 - switchTurnScreenX2) / 20) * deltaTime;
            }
        }
    
        if (keys["Enter"]) {
            turn++;
            turn %= 2;
            hasDrawn = false;

            showProceedButton = false;
            switchTurnTimer = 0;
        
            transitionOut = true;
        }
    } else {
        if (turn == PIECECOLOR.BLACK) {
            if (512 - switchTurnScreenX1 < 5) {
                switchTurnScreenX1 = 512;
            }
            if (512 - switchTurnScreenX2 < 5) {
                switchTurnScreenX2 = 512;
                transitionOut = false;
                switchingTurn = false;
            }
        } else if (turn == PIECECOLOR.WHITE) {
            if (-512 - switchTurnScreenX1 > -5) {
                switchTurnScreenX1 = -512;
            }
            if (-512 - switchTurnScreenX2 > -5) {
                switchTurnScreenX2 = -512;
                transitionOut = false;
                switchingTurn = false;
            }
        }

        ctx.beginPath();
        ctx.fillStyle = "#ffffffff";
        ctx.font = String(50 * scale) + "px Arial";
        ctx.fillText("Switching Turn", (85 + switchTurnScreenX1) * scale, 80 * scale);
        if (turn == PIECECOLOR.WHITE) {
            ctx.fillText("To White", (150 + switchTurnScreenX1) * scale, 160 * scale);
        }
        if (turn == PIECECOLOR.BLACK) {
            ctx.fillText("To Black", (150 + switchTurnScreenX1) * scale, 160 * scale);
        }
        ctx.font = String(30 * scale) + "px Arial";
        ctx.fillText("Press Enter to Confirm", (95 + switchTurnScreenX1) * scale, 320 * scale);

        if (turn == PIECECOLOR.BLACK) {
            switchTurnScreenX1 += ((512 - switchTurnScreenX1) / 20) * deltaTime;
            if (switchTurnTimer > 10) {
                switchTurnScreenX2 += ((512 - switchTurnScreenX2) / 20) * deltaTime;
            }
        } else if (turn == PIECECOLOR.WHITE) {
            switchTurnScreenX1 += ((-512 - switchTurnScreenX1) / 20) * deltaTime;
            if (switchTurnTimer > 10) {
                switchTurnScreenX2 += ((-512 - switchTurnScreenX2) / 20) * deltaTime;
            }
        }
    }
}

function renderProceedButton() {
    ctx.beginPath();
    ctx.roundRect(365 * scale, 285 * scale, 120 * scale, 50 * scale, 10 * scale);
    if (mouseX > 373 * scale && mouseX < 493 * scale && mouseY > 294 * scale && mouseY < 344 * scale) {
        if (mouseDown) {
            ctx.fillStyle = "#ffffffff";
            if ((!onlineMode && !switchingTurn) || (onlineMode && oSelfCol == turn)) {
                switchTurn();
            }
        } else {
            ctx.fillStyle = "#8855bbff";
        }
    } else {
        ctx.fillStyle = "#552288ff";
    }
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#ffffffff";
    ctx.font = String(25 * scale) + "px Arial";
    ctx.fillText("Proceed", 377 * scale, 318 * scale);
}

function renderAll() {
    renderBackground();
    renderBoard();
    renderOpponentCardCount();
    renderPieces();
    if (!promoteMode && !showProceedButton && !switchingTurn) {
        renderHighlightedPieces();
    }
    renderHoverHighlight();
    renderDrawPile();
    renderDeck();
    if (showProceedButton) {
        renderProceedButton();
    }
    renderBoardDeckOverlay();
    renderDrawPileOverlay();
    if (drawingCard) {
        drawCardTimer += deltaTime;
        renderDrawCard();
    }
    if (placingCard) {
        placeCardTimer += deltaTime;
        renderPlaceCard();
    }
    if (promoteMode) {
        promoteRenderBannerWidth += ((1 - promoteRenderBannerWidth) / 15) * deltaTime;
        renderPromoteSelect();
    }
    if (switchingTurn) {
        switchTurnTimer += deltaTime;
        renderSwitchTurn();
    }
}

function updatePieces() {
    for (var i = 0; i < pieceArray.length; i++) {
        for (var j = 0; j < pieceArray[i].length; j++) {
            if (pieceArray[i][j] != null && pieceArray[i][j].col == turn) {
                pieceArray[i][j].checkClick();
            }
        }
    }
}

function updateHighlightedPieces() {
    for (var i = 0; i < highlightedPieceList.length; i++) {
        if (mouseBoardX == highlightedPieceList[i].x && mouseBoardY == highlightedPieceList[i].y) {
            if (mouseDown) {
                // move
                if (onlineMode) {
                    // move to info (x, y, type, col, passantable), previous info (x, y), (optional info (x, y))
                    if (Object.hasOwn(highlightedPieceList[i], "z")) {
                        if (selectedPiece.type == PIECETYPE.PAWN) {
                            oGameMove = String(highlightedPieceList[i].x)+","+String(highlightedPieceList[i].y)+","+String(selectedPiece.type)+","+String(selectedPiece.col)+","+String(selectedPiece.canPassant)+","+String(selectedPiece.pos.x)+","+String(selectedPiece.pos.y)+","+String(highlightedPieceList[i].z)+","+String(highlightedPieceList[i].w);
                        } else {
                            oGameMove = String(highlightedPieceList[i].x)+","+String(highlightedPieceList[i].y)+","+String(selectedPiece.type)+","+String(selectedPiece.col)+",false,"+String(selectedPiece.pos.x)+","+String(selectedPiece.pos.y)+","+String(highlightedPieceList[i].z)+","+String(highlightedPieceList[i].w);
                        }
                    } else {
                        if (selectedPiece.type == PIECETYPE.PAWN) {
                            oGameMove = String(highlightedPieceList[i].x)+","+String(highlightedPieceList[i].y)+","+String(selectedPiece.type)+","+String(selectedPiece.col)+","+String(selectedPiece.canPassant)+","+String(selectedPiece.pos.x)+","+String(selectedPiece.pos.y);
                        } else {
                            oGameMove = String(highlightedPieceList[i].x)+","+String(highlightedPieceList[i].y)+","+String(selectedPiece.type)+","+String(selectedPiece.col)+",false,"+String(selectedPiece.pos.x)+","+String(selectedPiece.pos.y);
                        }
                    }
                }

                pieceArray[highlightedPieceList[i].y][highlightedPieceList[i].x] = selectedPiece;
                pieceArray[selectedPiece.pos.y][selectedPiece.pos.x] = null;

                if (Object.hasOwn(highlightedPieceList[i], "z")) {
                    pieceArray[highlightedPieceList[i].w][highlightedPieceList[i].z] = null;
                }

                if (selectedPiece.type == PIECETYPE.KING && Math.abs(highlightedPieceList[i].x - selectedPiece.pos.x) == 2) {
                    if (highlightedPieceList[i].x == 2) {
                        pieceArray[highlightedPieceList[i].y][3] = pieceArray[highlightedPieceList[i].y][0];
                        pieceArray[highlightedPieceList[i].y][0] = null;

                        pieceArray[highlightedPieceList[i].y][3].pos.x = 3;
                        pieceArray[highlightedPieceList[i].y][3].move++;
                    }
                    if (highlightedPieceList[i].x == 6) {
                        pieceArray[highlightedPieceList[i].y][5] = pieceArray[highlightedPieceList[i].y][7];
                        pieceArray[highlightedPieceList[i].y][7] = null;

                        pieceArray[highlightedPieceList[i].y][5].pos.x = 5;
                        pieceArray[highlightedPieceList[i].y][5].move++;
                    }
                }

                for (var k = 0; k < pieceArray.length; k++) {
                    for (var j = 0; j < pieceArray[k].length; j++) {
                        if (pieceArray[k][j] != null && pieceArray[k][j].col == turn && pieceArray[k][j].type == PIECETYPE.PAWN && pieceArray[k][j].canPassant == true) {
                            pieceArray[k][j].canPassant = false; // no longer passant-able
                        }
                    }
                }

                selectedPiece.move++;
                if (selectedPiece.type == PIECETYPE.PAWN) {
                    if (selectedPiece.canPassant == false && Math.abs(selectedPiece.pos.y - highlightedPieceList[i].y) == 2) {
                        selectedPiece.canPassant = true;
                    }
                }

                selectedPiece.pos.x = highlightedPieceList[i].x;
                selectedPiece.pos.y = highlightedPieceList[i].y;

                if (selectedPiece.type == PIECETYPE.PAWN && ((selectedPiece.pos.y == 0 && selectedPiece.col == PIECECOLOR.WHITE) || (selectedPiece.pos.y == 7 && selectedPiece.col == PIECECOLOR.BLACK))) {
                    promoteRenderBannerWidth = 0;
                    promoteMode = true;
                }

                if (!promoteMode) {
                    if (checkCheck(false)) {
                        if (turn == PIECECOLOR.WHITE) { blackChecked = true; }
                        if (turn == PIECECOLOR.BLACK) { whiteChecked = true; }
                    } else {
                        if (turn == PIECECOLOR.WHITE) { whiteChecked = false; }
                        if (turn == PIECECOLOR.BLACK) { blackChecked = false; }
                    }
    
                    showProceedButton = true;
    
                    highlightedPieceList = [];
                    selectedPiece = null;
                }

                break;
            }
        }
    }
}

function checkCheck(flipColors) {
    for (var i = 0; i < pieceArray.length; i++) {
        for (var j = 0; j < pieceArray[i].length; j++) {
            if (pieceArray[i][j] != null && ((!flipColors && pieceArray[i][j].col == turn) || (flipColors && pieceArray[i][j].col != turn))) {
                pieceArray[i][j].calculateSelected();
                var a = pieceArray[i][j].calculateSelected();
                for (var k = 0; k < a.length; k++) {
                    if (Object.hasOwn(a[k], "z")) {
                        if (pieceArray[a[k].w][a[k].z] != null && pieceArray[a[k].w][a[k].z].type == PIECETYPE.KING) {
                            return true;
                        }
                    } else {
                        if (pieceArray[a[k].y][a[k].x] != null && pieceArray[a[k].y][a[k].x].type == PIECETYPE.KING) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

function promote() {
    if (keys["q"]) {
        selectedPiece.type = PIECETYPE.QUEEN;
        oGameMove = oGameMove.split(",");
        oGameMove[2] = String(PIECETYPE.QUEEN);
        oGameMove = oGameMove.join(",");
    }
    if (keys["r"]) {
        selectedPiece.type = PIECETYPE.ROOK;
        oGameMove = oGameMove.split(",");
        oGameMove[2] = String(PIECETYPE.ROOK);
        oGameMove = oGameMove.join(",");
    }
    if (keys["b"]) {
        selectedPiece.type = PIECETYPE.BISHOP;
        oGameMove = oGameMove.split(",");
        oGameMove[2] = String(PIECETYPE.BISHOP);
        oGameMove = oGameMove.join(",");
    }
    if (keys["n"]) {
        selectedPiece.type = PIECETYPE.KNIGHT;
        oGameMove = oGameMove.split(",");
        oGameMove[2] = String(PIECETYPE.KNIGHT);
        oGameMove = oGameMove.join(",");
    }

    if (keys["q"] || keys["r"] || keys["b"] || keys["n"]) {
        if (checkCheck(false)) {
            if (turn == PIECECOLOR.WHITE) { blackChecked = true; }
            if (turn == PIECECOLOR.BLACK) { whiteChecked = true; }
        } else {
            if (turn == PIECECOLOR.WHITE) { whiteChecked = false; }
            if (turn == PIECECOLOR.BLACK) { blackChecked = false; }
        }

        showProceedButton = true;

        highlightedPieceList = [];
        selectedPiece = null;

        promoteMode = false;
    }
}

function updateAll() {
    if (promoteMode) {
        promote();
    }
    if (!showProceedButton && !switchingTurn && !promoteMode && !drawingCard && !placingCard && hasDrawn) {
        updateHighlightedPieces();
    }
    // separate if statement in case condition triggers with updateHighlightedPieces
    if (!showProceedButton && !switchingTurn && !promoteMode && !drawingCard && !placingCard && hasDrawn) {
        updatePieces();
    }
}

var onlineCode;
var onlineMode = false;

function main() {
    switch(gameScreen) {
        case GAMESCREEN.NULL_TO_TITLE: {
            gameScreen = GAMESCREEN.TITLE;
            break;
        }
        case GAMESCREEN.TITLE: {
            // background
            ctx.beginPath();
            ctx.fillStyle = "#7744aaff";
            ctx.fillRect(0, 0, 512 * scale, 512 * scale);

            // stripes
            ctx.beginPath();
            ctx.fillStyle = "#6633aaff";
            ctx.fillRect(0, 0 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 80 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 160 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 240 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 320 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 400 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 480 * scale, 512 * scale, 40 * scale);

            // title
            ctx.beginPath();
            ctx.fillStyle = "#ffffffff";
            ctx.font = String(80 * scale) + "px Georgia";
            ctx.fillText("CardChess", 60 * scale, 120 * scale);

            // local button
            ctx.beginPath();
            if (mouseX > 180 * scale && mouseX < 340 * scale && mouseY > 200 * scale && mouseY < 260 * scale) {
                ctx.fillStyle = "#551199ff";
                if (mouseDown) {
                    ctx.fillStyle = "#ffffffff";
                    gameScreen = GAMESCREEN.TITLE_TO_LOCAL;
                }
            } else {
                ctx.fillStyle = "#441188ff";
            }
            ctx.roundRect(170 * scale, 190 * scale, 160 * scale, 60 * scale, 10 * scale);
            ctx.fill();
            ctx.fillStyle = "#ffffffff";
            ctx.font = String(30 * scale) + "px Georgia";
            ctx.fillText("LOCAL", 200 * scale, 230 * scale);

            // online button
            ctx.beginPath();
            if (mouseX > 180 * scale && mouseX < 340 * scale && mouseY > 280 * scale && mouseY < 340 * scale) {
                ctx.fillStyle = "#551199ff";
                if (mouseDown) {
                    ctx.fillStyle = "#ffffffff";
                    gameScreen = GAMESCREEN.TITLE_TO_ROOM;
                }
            } else {
                ctx.fillStyle = "#441188ff";
            }
            ctx.roundRect(170 * scale, 270 * scale, 160 * scale, 60 * scale, 10 * scale);
            ctx.fill();
            ctx.fillStyle = "#ffffffff";
            ctx.font = String(30 * scale) + "px Georgia";
            ctx.fillText("ONLINE", 190 * scale, 310 * scale);

            break;
        }
        case GAMESCREEN.TITLE_TO_LOCAL: {
            turn = PIECECOLOR.WHITE;
            gameScreen = GAMESCREEN.LOCAL;
            break;
        }
        case GAMESCREEN.LOCAL: {
            updateAll();
            renderAll();
            break;
        }
        case GAMESCREEN.TITLE_TO_ROOM: {
            onlineCode = "";
            gameScreen = GAMESCREEN.ROOM;
            break;
        }
        case GAMESCREEN.ROOM: {
            // background
            ctx.beginPath();
            ctx.fillStyle = "#7744aaff";
            ctx.fillRect(0, 0, 512 * scale, 512 * scale);

            // stripes
            ctx.beginPath();
            ctx.fillStyle = "#6633aaff";
            ctx.fillRect(0, 0 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 80 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 160 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 240 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 320 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 400 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 480 * scale, 512 * scale, 40 * scale);

            // title
            ctx.beginPath();
            ctx.fillStyle = "#ffffffff";
            ctx.font = String(50 * scale) + "px Georgia";
            ctx.fillText("Create or Join Room", 30 * scale, 100 * scale);

            // text input background
            ctx.beginPath();
            ctx.fillStyle = "#441188ff";
            ctx.roundRect(140 * scale, 190 * scale, 220 * scale, 60 * scale, 10 * scale);
            ctx.fill();
            ctx.fillStyle = "#ffffffff";
            ctx.font = String(30 * scale) + "px Georgia";
            ctx.fillText(onlineCode, 160 * scale, 230 * scale);

            if (onlineCode.length >= 8) {
                gameScreen = GAMESCREEN.ROOM_TO_WAIT;
            }

            break;
        }
        case GAMESCREEN.ROOM_TO_WAIT: {
            get(child(ref(database), `games/${onlineCode}`)).then((snapshot) => {
                if (snapshot.exists()) {
                    joinOnline();
                } else {
                    createOnline();
                }
                gameScreen = GAMESCREEN.WAIT;
            }).catch((error) => {
                console.error(error);
            });
            break;
        }
        case GAMESCREEN.WAIT: {
            // background
            ctx.beginPath();
            ctx.fillStyle = "#7744aaff";
            ctx.fillRect(0, 0, 512 * scale, 512 * scale);

            // stripes
            ctx.beginPath();
            ctx.fillStyle = "#6633aaff";
            ctx.fillRect(0, 0 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 80 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 160 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 240 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 320 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 400 * scale, 512 * scale, 40 * scale);
            ctx.fillRect(0, 480 * scale, 512 * scale, 40 * scale);

            // title
            ctx.beginPath();
            ctx.fillStyle = "#ffffffff";
            ctx.font = String(50 * scale) + "px Georgia";
            ctx.fillText("Awaiting Connection...", 5 * scale, 100 * scale);

            // text input background
            ctx.beginPath();
            ctx.fillStyle = "#441188ff";
            ctx.roundRect(140 * scale, 190 * scale, 220 * scale, 60 * scale, 10 * scale);
            ctx.fill();
            ctx.fillStyle = "#ffffffff";
            ctx.font = String(30 * scale) + "px Georgia";
            ctx.fillText(onlineCode, 160 * scale, 230 * scale);
            break;
        }
        case GAMESCREEN.WAIT_TO_ONLINE: {
            console.log(oSelfCol);
            onlineMode = true;
            turn = PIECECOLOR.WHITE;
            gameScreen = GAMESCREEN.ONLINE;
            break;
        }
        case GAMESCREEN.ONLINE: {
            updateAll();
            renderAll();
            break;
        }
    }
}

var oSelfID;
var oGameRef;

var oSelfCol;

var oGameMove;
var pOGameMove;

function joinOnline() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // logged in

            oSelfID = user.uid;

            oGameRef = ref(database, `games/${onlineCode}`);

            update(oGameRef, {
                p2: oSelfID
            });

            onValue(oGameRef, (snapshot) => {
                pOGameMove = oGameMove;
                oGameMove = snapshot.val().move;
                if (pOGameMove != oGameMove) {
                    onlineMove();
                }
                // console.log(oGameMove);
            });

            onChildAdded(oGameRef, (snapshot) => {
                if (snapshot.val() == oSelfID) {
                //     get(child(ref(database), `games/${onlineCode}/initialTypeBoard`)).then((snapshot2) => {
                //         get(child(ref(database), `games/${onlineCode}/initialColBoard`)).then((snapshot3) => {
                //             if (snapshot2.exists()) {
                //                 console.log(snapshot2.val());
                //                 for (var lo = 0; lo < boardLength; lo++) {
                //                     for (var mo = 0; mo < boardLength; mo++) {
                //                         for (var no = 0; no < boardLength; no++) {
                //                             typeBoard[lo][mo][no] = (snapshot2.val()[(lo * boardLength * boardLength) + (mo * boardLength) + no] - 1);
                //                             colourBoard[lo][mo][no] = (snapshot3.val()[(lo * boardLength * boardLength) + (mo * boardLength) + no] - 1);
                //                         }
                //                     }
                //                 }
                //                 console.log(typeBoard);
                                oSelfCol = PIECECOLOR.BLACK;
                                gameScreen = GAMESCREEN.WAIT_TO_ONLINE;
                //             }
                //         });
                //     });
                }
            });

            onChildRemoved(oGameRef, (snapshot) => {
                // something like below:
                // oGameMove = "disconnect"
            });
        } else {
            // not logged in
        }
    });

    signInAnonymously(auth).catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;

        console.log(errorCode, errorMessage);
    });
}

function createOnline() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // logged in

            oSelfID = user.uid;

            oGameRef = ref(database, `games/${onlineCode}`);

            set(oGameRef, {
                move: "",
                // initialTypeBoard: oBoardTypeString,
                // initialColBoard: oBoardColString,
                p1: oSelfID
            });

            onDisconnect(oGameRef).remove();

            onValue(oGameRef, (snapshot) => {
                pOGameMove = oGameMove;
                oGameMove = snapshot.val().move;
                if (pOGameMove != oGameMove) {
                    onlineMove();
                }
                // console.log(oGameMove);
            });

            onChildAdded(oGameRef, (snapshot) => {
                // p2
                if (snapshot.val() != "" && snapshot.val() != oSelfID) {
                    oSelfCol = PIECECOLOR.WHITE;
                    gameScreen = GAMESCREEN.WAIT_TO_ONLINE;
                }
            });

            onChildRemoved(oGameRef, (snapshot) => {
                // something like below:
                // oGameMove = "disconnect"
            });
        } else {
            // not logged in
        }
    });

    signInAnonymously(auth).catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;

        console.log(errorCode, errorMessage);
    });
}

function onlineMove() {
    // move to info (x, y, type, col, passantable), previous info (x, y), (optional info (x, y))
    oGameMove = oGameMove.split(",");
    
    pieceArray[Number(oGameMove[1])][Number(oGameMove[0])] = new Piece(new Vector2(Number(oGameMove[0]), Number(oGameMove[1])), Number(oGameMove[2]), Number(oGameMove[3]));
    pieceArray[Number(oGameMove[1])][Number(oGameMove[0])].canPassant = Boolean(oGameMove[4]);

    // piece moved (won't trigger if piece placed)
    if (oGameMove.length > 5) {
        pieceArray[Number(oGameMove[6])][Number(oGameMove[5])] = null;
        // fill card lists so that both clients report number of cards of opponent accurately
        if (oSelfCol == PIECECOLOR.WHITE && blackCardList.length < 16) { blackCardList.push("card count filler"); }
        if (oSelfCol == PIECECOLOR.BLACK && whiteCardList.length < 16) { whiteCardList.push("card count filler"); }
    } else {
        if (oSelfCol == PIECECOLOR.WHITE && blackCardList.length == 16) { blackCardList.pop(); }
        if (oSelfCol == PIECECOLOR.BLACK && whiteCardList.length == 16) { whiteCardList.pop(); }
    }

    // en passant capture
    if (oGameMove.length > 7) {
        pieceArray[Number(oGameMove[8])][Number(oGameMove[7])] = null;
    }

    turn++; turn %= 2;
}

var deltaTime = 0;
var deltaCorrect = (1 / 8);
var prevTime = Date.now();
function loop() {
    deltaTime = (Date.now() - prevTime) * deltaCorrect;
    prevTime = Date.now();

    main();
    window.requestAnimationFrame(loop);
}

function init() {
    gameScreen = GAMESCREEN.NULL_TO_TITLE;
    window.requestAnimationFrame(loop)
}
window.requestAnimationFrame(init);
