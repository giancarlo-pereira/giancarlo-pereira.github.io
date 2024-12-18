// SUPPORT FOR STEREO VIEWING ON A PHONE

document.body.addEventListener('click', () => {
    if (DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
       DeviceMotionEvent.requestPermission()
          .then(permissionState => {})
          .catch(console.error);
    }
 }, { once: true });
 
 let imu = { };
 if (window.DeviceOrientationEvent)
    window.addEventListener('deviceorientation', event => {
       imu.alpha = event.alpha;                             // COMPASS DIRECTION, IN DEGREES
       imu.beta  = event.beta;                              // TILT FRONT TO BACK IN DEGREES
       imu.gamma = event.gamma;                             // TILT LEFT TO RIGHT IN DEGREES
    });
 
 // MATH AND VECTOR SUPPORT

 // CONVERTER TAKEN FROM
 // https://bito.ai/resources/rgb-to-hex-javascript-javascript-explained/#:~:text=To%20convert%20RGB%20color%20codes%20to%20hexadecimal%2C%20you%20need%20to,representation%20of%20the%20color%20code.
 function componentToHex(c) {
   return c.toString(16).padStart(2, '0');
 }

 function rgbToHex(rgb) {
   let r = (rgb[0] < 1) ? Math.floor(255*rgb[0]) : Math.floor(rgb[0]);
   let g = (rgb[1] < 1) ? Math.floor(255*rgb[1]) : Math.floor(rgb[1]);
   let b = (rgb[2] < 1) ? Math.floor(255*rgb[2]) : Math.floor(rgb[2]);
 
   let red = componentToHex(r);
   let green = componentToHex(g);
   let blue = componentToHex(b);
  
   return '#' + red + green + blue; // #FFC0CB
  
 }

// ALGORITHM TAKEN FROM
// https://stackoverflow.com/questions/75677/converting-a-uniform-distribution-to-a-normal-distribution
function normal_random(mean,stddev)
{
   var V1
   var V2
   var S
   do{
      var U1 = Math.random() // return uniform distributed in [0,1[
      var U2 = Math.random()
      V1 = 2*U1-1
      V2 = 2*U2-1
      S = V1*V1+V2*V2
   }while(S >= 1)
   if(S===0) return 0
   return mean+stddev*(V1*Math.sqrt(-2*Math.log(S)/S))
}

function random_int(max)
{
   return Math.floor(Math.random() * max);
}
 
 let TAU       = 2 * Math.PI;
 let pi        = Math.PI;
 let EPS       = 0.00001;
 let add       = (a,b)   => a.map((a,i) => a + b[i]);
 let cross     = (a,b)   => [ a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0] ];
 let distance  = (a,b)   => norm(subtract(a,b));
 let dot       = (a,b)   => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
 let ease      = t       => (t = Math.max(0,Math.min(1,t))) * t * (3 - t - t);
 let mix       = (a,b,t) => a[0]!==undefined ? a.map((a,i) => a + t * (b[i] - a)) : a + t * (b - a);
 let norm      = v       => Math.sqrt(dot(v,v));
 let normalize = v       => scale(v, 1 / (norm(v) > 0 ? norm(v) : 1) );
 let scale     = (a,s)   => a.map((a,i) => (s[i]!==undefined ? s[i] : s) * a);
 let subtract  = (a,b)   => a.map((a,i) => a - b[i]);

 // SPLINE
 let catmullRom = (K, t) => {
    let n = K.length -1, i = Math.floor(n * t), f = (n * t) % 1;
    let A = K[Math.max(0, i-1)], B = K[i], C = K[i+1], D = K[Math.min(n, i+2)]; // this does NOT wrap around
    return ((((-A+3*B-3*C+D) * f + (2*A-5*B+4*C-D)) * f + (-A+C)) * f + 2*B) / 2;
 }
 
 // TRACK THE MOUSE
 
 let trackMouse = (canvas, player) => {
    canvas.rx = 0;
    canvas.ry = 0;
    canvas.onmousedown = e => {
       canvas.pressed = true;
       canvas.mx = e.clientX;
       canvas.my = e.clientY;
    }
    canvas.onmousemove = e => {
       if (canvas.pressed) {
          canvas.rx += (e.clientX - canvas.mx)/45;
          canvas.ry += (e.clientY - canvas.my)/45;
          canvas.ry = Math.max(Math.min(canvas.ry, pi/2 - EPS), -pi/2 + EPS);
          canvas.mx = e.clientX;
          canvas.my = e.clientY;
          player.direction([C(canvas.rx), S(canvas.ry), S(canvas.rx)]);
       }
    }
    canvas.onmouseup = e => canvas.pressed = undefined;

    canvas.addEventListener('touchstart', e => {
      let touch = e.touches[0];
      let mouseEvent = new MouseEvent("mousedown", {
          clientX: touch.clientX,
          clientY: touch.clientY
      });
      canvas.dispatchEvent(mouseEvent);
    }, false);
    canvas.addEventListener('touchend', e => {
      let touch = e.touches[0];
      let mouseEvent = new MouseEvent("mouseup", {
          clientX: touch.clientX,
          clientY: touch.clientY
      });
      canvas.dispatchEvent(mouseEvent);
    }, false);
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        let touch = e.touches[0];
        let mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, false);
 }


// MAZE UTILS

function Cell(s, r, c, g, d) {
   let row = r;
   let column = c;
   let size = s;
   let grid = g;
   let mode = d;
   let pos = scale([column+0.5,0, row+0.5], size);

   let floorColor = [1, .9, .7];
   let floorTex = (mode==='debug') ? -1 : 2;
   let floorBtex = (mode==='debug') ? -1 : 3;
   let wallColor = (mode==='debug') ? [0, 0, 1] : [.9, .4, .1];
   let wallTex = (mode==='debug') ? -1 : 4;
   let wallBtex = (mode==='debug') ? -1 : 5;

   let selected = false;
   let visited  = false;
   let goal     = false;

   // for BFS
   let dist = Infinity;
   let parent = -1;

   this.parent = p => {
      if (p===undefined) return parent;
      parent=p;
   }
   this.dist = d => {
      if (d===undefined) return dist;
      dist=d;
   }

   let walls = {
      top: true,
      bottom: true,
      left: true,
      right: true
   }

   this.column     = () => column;
   this.row        = () => row;   
   this.position   = () => pos;
   this.size       = () => size;
   this.boundaries = () => walls;

   this.select   = () => selected = true;
   this.unselect = () => selected = false;

   this.visited = bool => {
      if (bool===undefined) return visited;
      visited = bool;
   }

   this.isGoal  = bool => {
      if (bool===undefined) return goal;
      goal = bool;
      if (goal===true) {
         if (row===0) walls['bottom']=false;
         else if (column===0) walls['right']=false;
         else if (row==grid.length - 1) walls['top']=false;
         else if (column===grid[row].length - 1) walls['left']=false;
      }
   }

   this.getNeighbors = () => {
      let neighbors = [];

      // check if any neighbors available
      let bottom = walls['bottom'] ? undefined : grid[row - 1][column];
      let left = walls['left'] ? undefined : grid[row][column + 1];
      let top = walls['top'] ? undefined : grid[row + 1][column];
      let right = walls['right'] ? undefined : grid[row][column - 1];

      // push cells (univisited) to neighbors array
      if (top && !top.visited())       neighbors.push(top);
      if (right && !right.visited())   neighbors.push(right);
      if (bottom && !bottom.visited()) neighbors.push(bottom);
      if (left && !left.visited())     neighbors.push(left);

      return neighbors;
   }

   // FOR MAZE CONSTRUCTION
   this.getRandomNeighbor = () => {
      let neighbors = [];

      // check if any neighbors available
      let bottom = row === 0 ? undefined : grid[row - 1][column];
      let left = column === grid[row].length - 1 ? undefined : grid[row][column + 1];
      let top = row === grid.length - 1 ? undefined : grid[row + 1][column];
      let right = column === 0 ? undefined : grid[row][column - 1];

      // push cells (univisited) to neighbors array
      if (top && !top.visited())       neighbors.push(top);
      if (right && !right.visited())   neighbors.push(right);
      if (bottom && !bottom.visited()) neighbors.push(bottom);
      if (left && !left.visited())     neighbors.push(left);

      // Choose a random neighbor
      if (neighbors.length > 0) {
         let random = random_int(neighbors.length);
         return neighbors[random];
      } else {
         return undefined;
      }
   }

   this.removeWall = neighbor => {
      let neighborColumn = neighbor.column();
      let neighborRow    = neighbor.row();
      let neighborWalls  = neighbor.boundaries();

      if (neighborColumn - column == 1) {
         neighborWalls['right'] = false;
         walls['left'] = false;
      }
      else if (column - neighborColumn == 1) {
         walls['right'] = false;
         neighborWalls['left'] = false;
      }
      else if (neighborRow - row == 1) {
         neighborWalls['bottom'] = false;
         walls['top'] = false;
      }
      else if ( row - neighborRow == 1) {
         walls['bottom'] = false;
         neighborWalls['top'] = false;
      }
   }


   // FOR 2D MAZE CONSTRUCTION
   this.drawTopWall = (ctx, s, offsetX, offsetZ) => {
      ctx.beginPath();
      let position1 = add(scale(add(pos, scale([1,0,1], size/2)), s), [offsetX, 0, offsetZ]);
      let position2 = add(scale(add(pos, scale([-1,0,1], size/2)), s), [offsetX, 0, offsetZ]);
      let x = position1[0], z = position1[2];
      ctx.moveTo(x,z);
      x = position2[0], z = position2[2];
      ctx.lineTo(x,z);
      ctx.stroke();
   }
   this.drawBottomWall = (ctx, s, offsetX, offsetZ) => {
      ctx.beginPath();
      let position1 = add(scale(add(pos, scale([-1,0,-1], size/2)), s), [offsetX, 0, offsetZ]);
      let position2 = add(scale(add(pos, scale([1,0,-1], size/2)), s), [offsetX, 0, offsetZ]);
      let x = position1[0], z = position1[2];
      ctx.moveTo(x,z);
      x = position2[0], z = position2[2];
      ctx.lineTo(x,z);
      ctx.stroke();
   }
   this.drawLeftWall = (ctx, s, offsetX, offsetZ) => {
      ctx.beginPath();
      let position1 = add(scale(add(pos, scale([1,0,-1], size/2)), s), [offsetX, 0, offsetZ]);
      let position2 = add(scale(add(pos, scale([1,0,1], size/2)), s), [offsetX, 0, offsetZ]);
      let x = position1[0], z = position1[2];
      ctx.moveTo(x,z);
      x = position2[0], z = position2[2];
      ctx.lineTo(x,z);
      ctx.stroke();
   }
   this.drawRightWall = (ctx, s, offsetX, offsetZ) => {
      ctx.beginPath();
      let position1 = add(scale(add(pos, scale([-1,0,1], size/2)), s), [offsetX, 0, offsetZ]);
      let position2 = add(scale(add(pos, scale([-1,0,-1], size/2)), s), [offsetX, 0, offsetZ]);
      let x = position1[0], z = position1[2];
      ctx.moveTo(x,z);
      x = position2[0], z = position2[2];
      ctx.lineTo(x,z);
      ctx.stroke();
   }

   this.drawX = (ctx, s, offsetX, offsetZ) => {
      ctx.strokeStyle = '#F40C00';
      ctx.beginPath();
      let position1 = add(scale(add(pos, scale([1,0,1], size/2)), s), [offsetX, 0, offsetZ]);
      let position2 = add(scale(add(pos, scale([-1,0,-1], size/2)), s), [offsetX, 0, offsetZ]);
      let position3 = add(scale(add(pos, scale([-1,0,1], size/2)), s), [offsetX, 0, offsetZ]);
      let position4 = add(scale(add(pos, scale([1,0,-1], size/2)), s), [offsetX, 0, offsetZ]);
      let x = position1[0], z = position1[2];
      ctx.moveTo(x,z);
      x = position2[0], z = position2[2];
      ctx.lineTo(x,z);
      ctx.stroke();
      x = position3[0], z = position3[2];      
      ctx.moveTo(x,z);
      x = position4[0], z = position4[2];
      ctx.lineTo(x,z);
      ctx.stroke();
   }

   this.draw2D = (ctx, s, offsetX, offsetZ) => {
      // Draws the cell on the maze map canvas
      ctx.strokeStyle = '#000000';
      if (walls['top'])    this.drawTopWall(ctx, s, offsetX, offsetZ);
      if (walls['right'])  this.drawRightWall(ctx, s, offsetX, offsetZ);
      if (walls['bottom']) this.drawBottomWall(ctx, s, offsetX, offsetZ);
      if (walls['left'])   this.drawLeftWall(ctx, s, offsetX, offsetZ);

      if (this.isGoal()) {
         this.drawX(ctx, s, offsetX, offsetZ);
      }
   }


   // FOR 3D RENDERING
   this.render = () => {
      // draw each wall
      if (walls['top'])    M.S().move(add(pos, [ 0, size/2, size/2])).scale(size/2, size/2, size/100).draw(myCube, wallColor, 1, wallTex, wallBtex).R();
      if (walls['bottom']) M.S().move(add(pos, [0, size/2, -size/2])).scale(size/2, size/2, size/100).draw(myCube, wallColor, 1, wallTex, wallBtex).R();
      if (walls['right'])  M.S().move(add(pos, [-size/2, size/2, 0])).turnX(pi/2).scale(size/100, size/2, size/2).draw(myCube, wallColor, 1, wallTex, wallBtex).R();
      if (walls['left'])   M.S().move(add(pos, [ size/2, size/2, 0])).turnX(pi/2).scale(size/100, size/2, size/2).draw(myCube, wallColor, 1, wallTex, wallBtex).R();

      // draw floor
      if (mode!=='debug') {
         M.S().move(pos).scale(size/2, size/100, size/2).draw(myCube, floorColor, 1, goal ? 0 : floorTex, goal ? 1 : floorBtex).R();
      } else {
         M.S().move(pos).scale(size/2, size/100, size/2).draw(myCube, goal ? [0,1,0] : [1,0,0], 1, -1, -1).R();
      }
   }
}

function Maze(s, r, c, d) {
   let rows = r;
   let columns = c;
   let size = s;
   let mode = d;

   let grid = [];
   let stack = [];

   // CREATE ALL CELLS
   for (let r = 0; r < rows; r++) {
      let row = [];
      for (let c = 0; c < columns; c++) {
         let cell = new Cell(size, r, c, grid, mode);
         row.push(cell);
      }
      grid.push(row);
   }

   this.fetch = (row, column) => {
      return grid[row][column];
   }

   this.unvisitAll = () => {
      grid.forEach(row =>{
         row.forEach(cell => {
            cell.visited(false);
         })
      })
   }
   this.resetBFS = () => {
      grid.forEach(row =>{
         row.forEach(cell => {
            cell.parent(-1);
            cell.dist(Infinity);
         })
      })
   }

   // START IN RANDOM CELL, CLOSER TO CENTER OF MAZE
   let startRow = Math.floor(Math.max(Math.min(normal_random(rows/2, rows/10), rows - 1), 0));
   let startColumn = Math.floor(Math.max(Math.min(normal_random(columns/2, columns/10), columns - 1), 0));

   let current = this.fetch(startRow, startColumn);
   stack.push(current);

   // PICK EXIT CELL AT BORDER OF MAZE
   let goalColumn, goalRow;
   if (Math.random() > 0.5) {
      goalColumn = (Math.random() > 0.5) ? columns - 1 : 0;
      goalRow = random_int(rows);
   } else {
      goalRow = (Math.random() > 0.5) ? rows - 1 : 0;
      goalColumn = random_int(columns);
   }

   let goal = this.fetch(goalRow, goalColumn);
   goal.isGoal(true);

   // RECURSE TO CREATE MAZE WITH REMOVED WALLS
   while (stack.length > 0) {
      let next = current.getRandomNeighbor();
      // If there is a non visited neighbour cell
      if (next) {
         next.visited(true);
         // Add the current cell to the stack for backtracking
         stack.push(current);
         // This function compares the current cell to the next cell and removes the relevant walls for each cell
         current.removeWall(next);
         // Set the nect cell to the current cell
         current = next;

         // Else if there are no available neighbours start backtracking using the stack
      } else if (stack.length > 0) {
         let cell = stack.pop();
         current = cell;
      }
   }
   this.unvisitAll();

   this.getCurrentCell = pos => {
      let r = Math.floor(pos[2] / size);
      let c = Math.floor(pos[0] / size);
      if ((r > rows - 1 || r < 0 ) || (c > columns - 1 || c < 0)) {
         return undefined;
      }
      return this.fetch(r,c);
   }

   this.columns = () => columns;
   this.rows    = () => rows;
   this.size    = () => size;


   this.startWhere = () => {
      return this.fetch(startRow, startColumn).position();
   }

   this.render = () => {
      grid.forEach(row => {
         row.forEach(cell => {
            cell.render();
         })
      })
      // draw grass outside
      for (let i=-5; i<=columns+5; i++) {
         for (let j=-5; j<=rows+5; j++) {
            if (i >= columns || i < 0 || j >= rows || j < 0) M.S().move(scale([i+0.5,0, j+0.5], size)).scale(size/2, size/100, size/2).draw(myCube, [1, .9, .7] , 1, mode==='debug' ? -1 : 0, mode==='debug' ? -1 : 1).R();
         }
      }
   }

   this.bfs = cell => {
      cell.dist(0);
      let current = cell;
   
      // set up BFS variables
      let stack = [cell];

      while (stack.length > 0) {
         let neighbors = current.getNeighbors();
         neighbors.forEach(neighbor => {
            neighbor.visited(true);
            neighbor.parent(current);
            neighbor.dist(current.dist()+1);
            stack.push(neighbor);
         })
         current = stack.pop();
      }

      let path = [];
      current = goal;
      path.push(current);
      while (current!==cell) {
         let parent = current.parent();
          path.push(parent);
          current = parent;
      }

      path.push(cell); // add the original cell

      return path;
   }

   this.draw2DMap = (canvas, player) => {
      ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // color of brown paper bag
      ctx.fillStyle = '#b79f7c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "black";

      let offsetX = 36, offsetZ = 36;
      let xSize = size * columns, zSize = size * rows;
      let scale = canvas.width - 2 * 36;
      scale /= (xSize > zSize) ? xSize : zSize;

      ctx.lineWidth = scale / 8.8; // magic number

      offsetX = (canvas.width - scale * xSize)/2;
      offsetZ = (canvas.width - scale * zSize)/2;

      grid.forEach(row => {
         row.forEach(cell => {
            cell.draw2D(ctx, scale, offsetX, offsetZ);
         })
      })

      player.draw2D(ctx, scale, offsetX, offsetZ);

      // draw player positon as a triangle

   }

}

 // PLAYER FUNCTION

 function Player(maze, difficulty) {
   // up remains unchanged
   let up = [0, 1, 0];
   // front will move around
   let front = [+1, 0, 0];
   // side is the third axis
   let side = cross(front, up);

   let vf = 0, vs = 0;
   let speed = 1;
   let color = [.7,.7,.7], opacity = .95;
   // let pos = [0.,-.5,0];

   let height = maze.size()/2;

   let pos = add(maze.startWhere(), [0, height, 0]);
   
   let t = 0., moving = 0;
   let goalT = 0.;
   let reset = 0., thresh = 4.; //seconds

   let goal = false;
   this.isGoal = () => goal;
   this.goalTime = () => goalT;

   let mode = difficulty;
   this.mode = () => mode;

   // MAZE CELL
   let currentCell = undefined;

   this.vf = v => {
      if (v===undefined) return this.vf;
      vf=v;
   }
   this.vs = v => {
      if (v===undefined) return this.vs;
      vs=v;
   }

   this.speed = s => {
      if (s===undefined) return this.speed;
      speed = s;
   }

   this.direction = dir => {
      if (dir===undefined) return front;
      front=dir;
      // y direction remains unchanged
      front[1]=0;
      side = cross(front, up);
   }
   this.side     = () => side;
   this.position = () => pos;
   this.cell     = () => currentCell;
   this.height   = () => height;

   this.updatePosition = (time, maze) => {
      cell = maze.getCurrentCell(pos);

      if (cell.isGoal()) {
         goal = true;
         goalT = time;
      }

      // avoid unnecessary back-end calls if cell is still the same
      if (cell!==currentCell) this.updateCell(cell);
   }

   this.updateCell = cell => {
      if (currentCell!==undefined) currentCell.unselect();

      currentCell = cell;
      
      if (currentCell!==undefined) currentCell.select();
   }

   this.isMovePossible = pos => {
      if (currentCell!==undefined) {
         let walls   = currentCell.boundaries();
         let size    = currentCell.size();
         let cellPos = currentCell.position();
         // UP WALL
         if (   walls['top'] && pos[2] + size/10 > (cellPos[2] + size/2)) return false;
         if (walls['bottom'] && pos[2] - size/10 < (cellPos[2] - size/2)) return false;
         if (  walls['left'] && pos[0] + size/10 > (cellPos[0] + size/2)) return false;
         if ( walls['right'] && pos[0] - size/10 < (cellPos[0] - size/2)) return false;
      }
      return true;
   }

   this.move = time => {
      // update internal time
      let dt = time - t;
      t = time;

      // collect side velocity and front velocity
      let v = scale(normalize(add(scale(front, vf), scale(side, vs))),speed);
      // y never changes
      v[1]=0;

      // equation of motion
      new_pos = add(pos, scale(v, dt));

      // TEST BOUNDARIES, KEEP PLAYER WITHIN CELL GRID
      pos = this.isMovePossible(new_pos) ? new_pos : pos;
   };

   this.draw2D = (ctx, s, offsetX, offsetZ) => {
      // Draws the cell on the maze map canvas
      let position1 = add(scale(add(pos, scale(front, 1.5*height)), s), [offsetX, 0, offsetZ]);
      let position2 = add(scale(add(pos, scale(side, height/2)), s), [offsetX, 0, offsetZ]);
      let position3 = add(scale(add(pos, scale(side, -height/2)), s), [offsetX, 0, offsetZ]);;
      let x = position1[0], z = position1[2];
      ctx.beginPath();
      ctx.moveTo(x,z);
      x = position2[0], z = position2[2];
      ctx.lineTo(x,z);
      x = position3[0], z = position3[2];
      ctx.lineTo(x,z);
      ctx.closePath();
      ctx.strokeStyle = '#666666';
      ctx.stroke();
      ctx.fillStyle = "#FFCC00";
      ctx.fill();

   }
   this.render = (t,tex,btex) => {
      if (t-reset < thresh) return;
      opacity = Math.min(.95,(t-reset-thresh)*.1);
      if (moving==0) {
         M.S().move(pos[0] - size, pos[1] - size, pos[2]).scale(size/4).draw(Torus(30),color,opacity, -1, -1).R();  
         M.S().move(pos[0] - size*1.5, pos[1] - size*1.5, pos[2]).scale(size/6).draw(Torus(30),color,opacity, -1, -1).R(); 
         M.S().move(pos[0] - size*1.9, pos[1] - size*1.9, pos[2]).scale(size/8).draw(Torus(30),color,opacity, -1, -1).R();   
      }
      M.S().move(pos[0],pos[1],pos[2]).turnZ(angle[2]).turnX(angle[0]).turnY(angle[1]).scale(size).draw(Sphere(300),color,opacity, tex, btex).R();
   }
}

function mapPower(difficulty, c) {
   let mode = difficulty;
   let rechargeRate  = (mode==='debug') ? 0 : (mode==='peace') ? 100 : 1;
   let dischargeRate = (mode==='debug') ? 0 :(mode==='peace') ? 1  : 20;
   let full = 100; // start with powers full
   let time;

   let canvas = c;

   let disabled = (mode==='hard') ? true : false;
   let active = false;

   this.isActive = () => active;
   this.activate = () => {
      if (disabled) return; // if disabled, do nothing

      if (active) { // if already active, deactivate
         active = false;
         return;
      }

      if (full < 100) return; // wait for it to fully charge

      active = true;
   }

   this.update = t => {
      if (disabled) return;
      if (time===undefined) {time=t; return;}
      let dt = t-time;
      time=t; // update internal clock
      let change = active ? -dischargeRate*dt : rechargeRate*dt;

      full += change;
      full = Math.max( Math.min(full, 100), 0); // clip it between 0 and 100

      if (full < EPS) {
         active = false; // deactivate power if reached zero 

         // hide everything
         ctx = canvas.getContext('2d')
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.fillStyle = '#b79f7c';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

   }

   this.draw2D = () => {
      ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (disabled) {
         // red color to show DISABLED
         ctx.fillStyle = '#F40C00';
         ctx.fillRect(0,0, canvas.width, canvas.height);
         return;
      }

      // gray color to show how much has been used
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // green color to show ACTIVE
      ctx.fillStyle = '#65C639';
      ctx.fillRect(0, 0, canvas.width * full / 100, canvas.height);
   }

   this.render = player => {
      let pos = player.position();
      let size = player.height();
      let f = player.direction();
      let s = player.side();
      M.S().move(add(pos, scale(add(add(f, [0, -.5, 0]), scale(s, size/2)), size/2))).aim(f).turnX(-pi/12).turnY(pi/8).scale(size/5, size/5, size/1000).draw(myCube, [1,1,1], 1, 6, 7).R();
   }

}

function splinePower(m, difficulty, c) {
   let maze = m;
   let mode = difficulty;
   let rechargeRate  = (mode==='debug') ? 0 : (mode==='peace') ? 100 : 1;
   let dischargeRate = (mode==='debug') ? 0 :(mode==='peace') ? 1  : 20;
   let full = 100; // start with powers full
   let time;

   let path = [];
   let splinePoints = [];

   let canvas = c;

   let disabled = false;
   let active = false;

   if (mode==='hard') disabled=true; // no power in hard mode

   this.isActive = () => active;
   this.activate = cell => {
      if (disabled) return; // if disabled, do nothing

      if (active) { // if already active, deactivate
         active = false;
         return;
      }

      if (full < 100) return; // wait for it to fully charge

      // calculate DFS
      path = maze.bfs(cell);

      // convert path to coordinates
      let positions = [];
      path.forEach(cell => {
         positions.push(cell.position());
      });

      // generate splines with 10 points in between
      splinePoints = generateSpline(positions, 10);

      active = true;
   }

   this.update = t => {
      if (disabled) return;
      if (time===undefined) {time=t; return;}
      let dt = t-time;
      time=t; // update internal clock
      let change = active ? -dischargeRate*dt : rechargeRate*dt;

      full += change;
      full = Math.max( Math.min(full, 100), 0); // clip it between 0 and 100

      if (full < EPS) {
         active = false; // deactivate power if reached zero
         splinePoints = []; // save memory
         path = [];
         maze.unvisitAll();
         maze.resetBFS();
      }

   }

   this.draw2D = () => {
      ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (disabled) {
         // red color to show DISABLED
         ctx.fillStyle = '#F40C00';
         ctx.fillRect(0,0, canvas.width, canvas.height);
         return;
      }

      // gray color to show how much has been used
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // green color to show ACTIVE
      ctx.fillStyle = '#65C639';
      ctx.fillRect(0, 0, canvas.width * full / 100, canvas.height);
   }

   this.render = (time) => {
      let s = maze.size();
      for (let i = 0; i < splinePoints.length; i++) {
         let spPoint = splinePoints[i];
         let sinePhase = Math.max(0, S(time - i*pi/12))
         let yShift = s*( 1/4 + 1/8*sinePhase);
         M.S().move(add(spPoint, [0, yShift, 0])).scale(s/50*(1+sinePhase)).draw(mySphere, [.4,.8,.2], .9, -1, -1).R();
      }
   }

}

 // HANDLE KEY EVENTS

 let handleKeys = (canvas, player, map, spline, instructionsTable) => {
   canvas.keyDown     = c => {
      switch(c) {
          case 'KeyA':        player.vs(-1);     break;
          case 'KeyS':        player.vf(-1);     break;
          case 'KeyD':        player.vs(1);      break;
          case 'KeyW':        player.vf(1);      break;
          case 'ShiftLeft':   player.speed(1.5); break;
          case 'ShifRight':   player.speed(1.5); break;
          case 'KeyP':        spline.activate(player.cell()); break;
          case 'KeyM':        map.activate();                 break;
          case 'KeyI':        instructionsTable.style.display==='none' ? instructionsTable.style.display='table' : instructionsTable.style.display='none';
      }
   }
   
   canvas.keyUp     = c => {
      switch(c) {
         case 'KeyA':        player.vs(0);      break;
         case 'KeyS':        player.vf(0);      break;
         case 'KeyD':        player.vs(0);      break;
         case 'KeyW':        player.vf(0);      break;
         case 'ShiftLeft':   player.speed(1);   break;
         case 'ShifRight':   player.speed(1);   break;
      }
   }
 }

 // INVERSE KINEMATICS
 
 let ik  = (a,b,C,D) => {
    let c=dot(C,C), x=(1+(a*a-b*b)/c)/2, y=dot(C,D)/c;
    for (let i = 0 ; i < 3 ; i++) D[i] -= y * C[i];
    y = Math.sqrt(Math.max(0,a*a - c*x*x) / dot(D,D));
    for (let i=0 ; i<3 ; i++) D[i] = x*C[i] + y*D[i];
    return D;
 }
 
 // PHYSICS
 
 function Spring() {
    this.getPosition = () => P;
    this.setDamping  = d  => D = d;
    this.setForce    = f  => F = f;
    this.setMass     = m  => M = Math.max(0.001, m);
    this.update = e => {
       V += (F - P) / M * e;
       P  = (P + V) * (1 - D * e);
    }
    let D = 1, F = 0, M = 1, P = 0, V = 0;
 }
 
 // MATRIX SUPPORT
 
 let mInverse = m => {
    let d = [], de = 0, co = (c, r) => {
       let s = (i, j) => m[c+i & 3 | (r+j & 3) << 2];
       return (c+r & 1 ? -1 : 1) * ( (s(1,1) * (s(2,2) * s(3,3) - s(3,2) * s(2,3)))
                                   - (s(2,1) * (s(1,2) * s(3,3) - s(3,2) * s(1,3)))
                                   + (s(3,1) * (s(1,2) * s(2,3) - s(2,2) * s(1,3))) );
    }
    for (let n = 0 ; n < 16 ; n++) d.push(co(n >> 2, n & 3));
    for (let n = 0 ; n <  4 ; n++) de += m[n] * d[n << 2]; 
    for (let n = 0 ; n < 16 ; n++) d[n] /= de;
    return d;
 }
 let mxm = (a, b) => {
    let d = [];
    for (let n = 0 ; n < 16 ; n++)
       d.push(a[n&3]*b[n&12] + a[n&3|4]*b[n&12|1] + a[n&3|8]*b[n&12|2] + a[n&3|12]*b[n&12|3]);
    return d;
 }
 let C = t => Math.cos(t), S = t => Math.sin(t);
 let mId = () => [ 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1 ];
 let mPOVPe=(fl, m) => mxm(m, [1,0,0,0, 0,1,0,0, 0,0,0,-1/fl, 0,0,1,0]);
 let mPe=(fl, m) => mxm(m, [1,0,0,0, 0,1,0,0, 0,0,1,-1/fl, 0,0,0,1]);
//  let mPe = (fl, m) => mxm(m, imu.alpha == null ? [1,0,0,0, 0,1,0,0, 0,0,1,-1/fl, 0,0,0,1]
//                                                : [1,0,0,0, 0,1,0,0, 0,0,0,-1/fl, 0,0,1,0]);
 let mRX = (t, m) => mxm(m, [1,0,0,0, 0,C(t),S(t),0, 0,-S(t),C(t),0, 0,0,0,1]);
 let mRY = (t, m) => mxm(m, [C(t),0,-S(t),0, 0,1,0,0, S(t),0,C(t),0, 0,0,0,1]);
 let mRZ = (t, m) => mxm(m, [C(t),S(t),0,0, -S(t),C(t),0,0, 0,0,1,0, 0,0,0,1]);
 let mSc = (x,y,z, m) => mxm(m, [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
 let mTr = (x,y,z, m) => mxm(m, [1,0,0,0, 0,1,0,0, 0,0,1,0, x[0]!==undefined?x[0]:x,
                                                            x[0]!==undefined?x[1]:y,
                                                            x[0]!==undefined?x[2]:z,1]);
let mX = m => [ m[0],  m[1],  m[2],  m[3]];
let mY = m => [ m[4],  m[5],  m[6],  m[7]];
let mZ = m => [ m[8],  m[9], m[10], m[11]];
let mW = m => [m[12], m[13], m[14], m[15]];
 
 function Matrix() {
    let stack = [mId()], top = 0;
    let set = arg => { stack[top] = arg; return this; }
    let get = () => stack[top];
    this.aim = (W,i) => {
       W = normalize(W);
       let a = cross(W,[1,0,0]), b = cross(W,[0,1,0]);
       let U = normalize(dot(a,a) > dot(b,b) ? a : b), V = cross(W,U);
       let A = i==0 ? [W,U,V] : i==1 ? [V,W,U] : [U,V,W];
       set(mxm(get(), [ A[0],0, A[1],0, A[2],0, 0,0,0,1 ].flat()));
       return this;
    }
    this.identity = () => set(mId());
    this.POVperspective = fl => set((mPOVPe(fl, get())));
    this.perspective    = fl => set((mPe(fl, get())));
    this.turnX = t => set(mRX(t, get()));
    this.turnY = t => set(mRY(t, get()));
    this.turnZ = t => set(mRZ(t, get()));
    this.scale = (x,y,z) => set(mSc(x,y?y:x,z?z:x, get()));
    this.move = (x,y,z) => set(mTr(x,y,z, get()));
    this.get = () => get();
    this.S = () => set(stack[top++].slice());
    this.R = () => --top;
    this.draw = (shape,color,opacity,texture,bumpTexture) => draw(shape,color,opacity,texture,bumpTexture);
 }
 
 // INITIALIZE WEBGL
 
 let start_gl = (canvas, vertexShader, fragmentShader) => {
    let gl = canvas.getContext("webgl");
    let program = gl.createProgram();
    gl.program = program;
    let addshader = (type, src) => {
       let shader = gl.createShader(type);
       gl.shaderSource(shader, src);
       gl.compileShader(shader);
       if (! gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw "Cannot compile shader:\n\n" + gl.getShaderInfoLog(shader);
       gl.attachShader(program, shader);
    };
 
    for (let i in materials) {
       let index = fragmentShader.indexOf('// MATERIAL');
       fragmentShader = fragmentShader.substring(0, index)
                      + 'if (uMaterial == ' + i + ') {' + materials[i] + '}'
                      + fragmentShader.substring(index);
    }
 
    addshader(gl.VERTEX_SHADER  , vertexShader  );
    addshader(gl.FRAGMENT_SHADER, fragmentShader);
    gl.linkProgram(program);
    if (! gl.getProgramParameter(program, gl.LINK_STATUS))
       throw "Could not link the shader program!";
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthFunc(gl.LEQUAL);
    let vertexAttribute = (name, size, position) => {
       let attr = gl.getAttribLocation(program, name);
       gl.enableVertexAttribArray(attr);
       gl.vertexAttribPointer(attr, size, gl.FLOAT, false, vertexSize * 4, position * 4);
    }
    vertexAttribute('aPos', 3, 0);
    vertexAttribute('aNor', 3, 3);
    vertexAttribute('aUV' , 2, 6);
    vertexAttribute('aTan', 3, 8);
    return gl;
 }
 
 // IMPLEMENT VARIOUS 3D SHAPES
 
 let createMesh = (nu, nv, p) => {
    let V = (u,v) => {
       let P = p(u,v);
       let getD = (du,dv) => {
          let Q = p(u+du,v+dv);
          let x = Q[0]-P[0], y = Q[1]-P[1], z = Q[2]-P[2], s = Math.sqrt(x*x + y*y + z*z);
          return [ x/s, y/s, z/s ];
       }
       let U = getD(.001, 0);
       if (P.length < 6)
          P = P.concat(cross(U, getD(0, .001)));
       return P.concat([u, 1-v, U[0], U[1], U[2]]);
    }
 
    let mesh = [];
    for (let j = nv-1 ; j >= 0 ; j--) {
       for (let i = 0 ; i <= nu ; i++)
          mesh.push(V(i/nu,(j+1)/nv),  V(i/nu,j/nv));
       mesh.push(V(1,j/nv), V(0,j/nv));
    }
    return new Float32Array(mesh.flat());
 }
 let sphere = (nu, nv) => createMesh(nu, nv, (u,v) => {
    let theta = 2 * Math.PI * u;
    let phi = Math.PI * (v - .5);
    let x = C(phi) * C(theta),
        y = C(phi) * S(theta),
        z = S(phi);
    return [ x,y,z ];
 });
 let tube = (nu, nv, i) => createMesh(nu, nv, (u,v) => {
    let U = C(2 * Math.PI * u),
        V = S(2 * Math.PI * u),
        W = 2 * v - 1;
    return i==0 ? [W,U,V] : i==1 ? [V,W,U] : [U,V,W];
 });
 let disk = (nu, nv) => createMesh(nu, nv, (u,v) => {
    let x = v * C(2 * Math.PI * u),
        y = v * S(2 * Math.PI * u);
    return [ x,y,0, 0,0,1 ];
 });
 let cylinder = (nu, i, r) => createMesh(nu, 6, (u,v) => {
    r = r ? r : 1;
    let x = C(2 * Math.PI * u),
        y = S(2 * Math.PI * u),
        t = Math.sqrt(4 + (1-r)*(1-r)), a = 2/t, b = (1-r)/t;
        swizzle = v => i==0 ? [v[2],v[0],v[1], v[5],v[3],v[4]]
                     : i==1 ? [v[1],v[2],v[0], v[4],v[5],v[3]]
                            : [v[0],v[1],v[2], v[3],v[4],v[5]];
    switch (5 * v >> 0) {
    case 0: return swizzle([   0,  0,-1,    0,  0,-1 ]);
    case 1: return swizzle([   x,  y,-1,    0,  0,-1 ]);
    case 2: return swizzle([   x,  y,-1,  a*x,a*y, b ]);
    case 3: return swizzle([ r*x,r*y, 1,  a*x,a*y, b ]);
    case 4: return swizzle([ r*x,r*y, 1,    0,  0, 1 ]);
    case 5: return swizzle([   0,  0, 1,    0,  0, 1 ]);
    }
 });
 let torus = (nu, nv, r, t) => createMesh(nu, nv, (u,v) => {
    r = r ? r : .5;
    t = t ? t : 1;
    let ct = C(2 * Math.PI * u);
    let st = S(2 * Math.PI * u);
    let cp = C(2 * Math.PI * v);
    let sp = S(2 * Math.PI * v);
    let x = (1 + r * cp) * ct,
        y = (1 + r * cp) * st,
        z =      r * Math.max(-t, Math.min(t, sp));
    return [ x,y,z ];
 });
 let strToTris = s => {
    let t = [], i;
    for (let n = 0 ; n < s.length ; n++)
       if ((i = 'N01'.indexOf(s.charAt(n))) >= 0)
          t.push(i-1);
    return new Float32Array(t);
 }
 let square=strToTris(`1N000111100 11000110100 N1000100100  N1000100100 NN000101100 1N000111100`);
 let cube = strToTris(`1N100111100 11100110100 N1100100100  N1100100100 NN100101100 1N100111100
                       N1N00N01N00 11N00N11N00 1NN00N10N00  1NN00N10N00 NNN00N00N00 N1N00N01N00
                       11N10011010 11110010010 1N110000010  1N110000010 1NN10001010 11N10011010
                       NN1N00100N0 N11N00000N0 N1NN00010N0  N1NN00010N0 NNNN00110N0 NN1N00100N0
                       N1101011001 11101010001 11N01000001  11N01000001 N1N01001001 N1101011001
                       1NN0N00100N 1N10N01100N NN10N01000N  NN10N01000N NNN0N00000N 1NN0N00100N`);
 
 // API FOR ACCESSING 3D SHAPES
 
 let Cube     = ()      => { return { type: 0, mesh: cube }; }
 let Cylinder = (n,i,r) => { return { type: 1, mesh: cylinder(n, i, r) }; }
 let Disk     = n       => { return { type: 1, mesh: disk    (n, 1) }; }
 let Sphere   = n       => { return { type: 1, mesh: sphere  (n, n>>1) }; }
 let Square   = ()      => { return { type: 0, mesh: square }; }
 let Torus    = (n,r,t) => { return { type: 1, mesh: torus   (n, n, r, t) }; }
 let Tube     = (n,i)   => { return { type: 1, mesh: tube    (n, 1, i) }; }
 
 let CreateMesh = (nu,nv,f) => { return { type: 1, mesh: createMesh(nu,nv,f) }; }
 
 let superquadric = (t,p) => {
    let f = (4 * t >> 0) / 4;
    t -= f + .125;
    t = TAU * (Math.sign(t) * Math.pow(Math.abs(8*t),1/p)/8 + f);
    let x = C(t), ax = Math.abs(x);
    let y = S(t), ay = Math.abs(y);
    let r = Math.pow(Math.pow(ax,p) + Math.pow(ay,p), 1/p);
    return [Math.sign(x)*ax/r, Math.sign(y)*ay/r];
 }
 

// PRE-BUILD ALL OBJECTS FOR EFFICIENCY
let myCube     = Cube();
let myCylinder = Cylinder(20);
let mySphere   = Sphere(20);
let mySquare   = Square();
 
 // GPU SHADERS
 
 let vertexSize = 11;
 let vertexShader = `
    attribute vec3 aPos, aNor, aTan;
    attribute vec2 aUV;
    uniform mat4 uMatrix, uInvMatrix, uVMatrix, uVInvMatrix;
    varying vec3 vPos, vNor, vTan, vTpos;
    varying vec2 vUV;
 
    uniform float uEye;
    varying float vClipX;
 
    void main() {
       vec4 pos = uVMatrix * uMatrix * vec4(aPos, 1.0);
       vec4 nor = vec4(aNor, 0.0) * uInvMatrix * uVInvMatrix;
       vec4 tan = vec4(aTan, 0.0) * uInvMatrix * uVInvMatrix;
       vec4 tpos = uMatrix * vec4(aPos, 1.0);
       vPos = pos.xyz;
       vNor = nor.xyz;
       vTan = tan.xyz;
       vTpos = tpos.xyz;
       vUV  = aUV;
 
       pos = mix(pos, vec4(.5 * pos.xyz, pos.w), uEye * uEye);
       pos.x += .45 * pos.w * uEye;
       vClipX = pos.x * uEye;
 
       gl_Position = pos * vec4(1.,1.,-.1,1.);
    }
 `;
 let fragmentShader = `
    precision mediump float;
    float noise(vec3 point) { float r = 0.; for (int i=0;i<16;i++) {
      vec3 D, p = point + mod(vec3(i,i/4,i/8) , vec3(4.0,2.0,2.0)) +
           1.7*sin(vec3(i,5*i,8*i)), C=floor(p), P=p-C-.5, A=abs(P);
      C += mod(C.x+C.y+C.z,2.) * step(max(A.yzx,A.zxy),A) * sign(P);
      D=34.*sin(987.*float(i)+876.*C+76.*C.yzx+765.*C.zxy);P=p-C-.5;
      r+=sin(6.3*dot(P,fract(D)-.5))*pow(max(0.,1.-2.*dot(P,P)),4.);
    } return .5 * sin(r); }
    uniform sampler2D uSampler[16];
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform int uTexture, uBumpTexture, uMaterial;
    varying vec3 vPos, vNor, vTan, vTpos;
    varying vec2 vUV;
 
    varying float vClipX;
 
    float attenuation(vec3 P, vec3 uLight) {
       vec3 dist = uLight - P;
       return 1. / dot(dist, dist); 
    }
 
    float diffuse(vec3 N, vec3 P, vec3 uLight) {
       vec3 surfToLight = normalize(uLight - P);
       return max(0., dot(N, surfToLight));
    }
 
    void main(void) {
 
       if (vClipX < 0.)
          discard;
 
       vec4 texture = vec4(1.);
       vec3 nor = normalize(vNor);
       for (int i = 0 ; i < 16 ; i++) {
          if (uTexture == i)
             texture = texture2D(uSampler[i], vUV);
          if (uBumpTexture == i) {
             vec3 b = 2. * texture2D(uSampler[i], vUV).rgb - 1.;
             vec3 tan = normalize(vTan);
             vec3 bin = cross(nor, tan);
             nor = normalize(b.x * tan + b.y * bin + b.z * nor);
          }
       }
       vec3 L = normalize(vec3(0.05,1.,0.05)), E = vec3(0.,0.,1.);
       float c = .05;
       // MATERIAL
       vec3 color = sqrt(uColor * c) * texture.rgb;
       float power = 40.;
      // color *= attenuation(vTpos, L);
       gl_FragColor = vec4(color, uOpacity * texture.a);
    }
 `;
 
 let materials = [];
 let addMaterial = (i,s) => materials[i] = s;
 
 // DECLARE GL-RELATED VARIABLES AND MATRIX OBJECT
 
 let gl, uBumpTexture, uColor, uEye, uInvMatrix, uMaterial, uMatrix, uOpacity, uSampler, uTexture, uVnvMatrix, uVMatrix;
 
 let startGL = canvas => {
    gl = start_gl(canvas, vertexShader, fragmentShader);
    uBumpTexture = gl.getUniformLocation(gl.program, "uBumpTexture");
    uColor       = gl.getUniformLocation(gl.program, "uColor"      );
 
    uEye         = gl.getUniformLocation(gl.program, "uEye"        );
 
    uInvMatrix   = gl.getUniformLocation(gl.program, "uInvMatrix"  );
    uMaterial    = gl.getUniformLocation(gl.program, "uMaterial"   );
    uMatrix      = gl.getUniformLocation(gl.program, "uMatrix"     );
    uOpacity     = gl.getUniformLocation(gl.program, "uOpacity"    );
    uSampler     = gl.getUniformLocation(gl.program, "uSampler"    );
    uTexture     = gl.getUniformLocation(gl.program, "uTexture"    );
    uVInvMatrix  = gl.getUniformLocation(gl.program, "uVInvMatrix" );
    uVMatrix     = gl.getUniformLocation(gl.program, "uVMatrix"    );
    gl.uniform1iv(uSampler, [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
 }
 
 let M = new Matrix();
 let VM = new Matrix();
 VM.identity();
 
 // LOAD A TEXTURE IMAGE
 
 let animatedSource = [];
 let material = 0;
 
 let texture = (index, source) => {
    if (typeof source == 'string') {
 
       // IF THE TEXTURE SOURCE IS AN IMAGE FILE, IT ONLY NEEDS TO BE SENT TO THE GPU ONCE.
 
       let image = new Image();
       image.onload = () => {
          gl.activeTexture (gl.TEXTURE0 + index);
          gl.bindTexture   (gl.TEXTURE_2D, gl.createTexture());
          gl.texImage2D    (gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR_MIPMAP_NEAREST);
          gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
          gl.generateMipmap(gl.TEXTURE_2D);
       }
       image.src = source;
    }
    else {
 
       // IF THE TEXTURE SOURCE IS ANYTHING ELSE, ITS CONTENT CAN CHANGE AT EVERY ANIMATION FRAME.
 
       gl.activeTexture (gl.TEXTURE0 + index);
       gl.bindTexture   (gl.TEXTURE_2D, gl.createTexture());
       gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
       gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
       animatedSource[index] = source;
    }
 }
 
 // DRAW A SINGLE SHAPE TO THE WEBGL CANVAS
 
 let draw = (Shape, color, opacity, texture, bumpTexture) => {
 
    // IF THIS IS AN ANIMATED TEXTURE SOURCE, SEND THE TEXTURE TO THE GPU AT EVERY ANIMATION FRAME.
 
    if (animatedSource[texture]) {
       gl.activeTexture(gl.TEXTURE0 + texture);
       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, animatedSource[texture]);
    }
 
    gl.uniform1f       (uOpacity    , opacity===undefined ? 1 : opacity);
    gl.uniform1i       (uTexture    , texture===undefined ? -1 : texture);
    gl.uniform1i       (uBumpTexture, bumpTexture===undefined ? -1 : bumpTexture);
    gl.uniform1i       (uMaterial   , material);
    gl.uniform3fv      (uColor      , color );
    gl.uniformMatrix4fv(uVInvMatrix , false, mInverse(VM.get()));
    gl.uniformMatrix4fv(uVMatrix    , false, VM.get()          );
    gl.uniformMatrix4fv(uInvMatrix  , false, mInverse(M.get()));
    gl.uniformMatrix4fv(uMatrix     , false, M.get()          );
    gl.bufferData(gl.ARRAY_BUFFER, Shape.mesh, gl.STATIC_DRAW);
    gl.drawArrays(Shape.type ? gl.TRIANGLE_STRIP : gl.TRIANGLES, 0, Shape.mesh.length / vertexSize);
    return M;
 }
 
 // DRAW THE SCENE FOR ONE ANIMATION FRAME, EITHER IN MONO OR IN STEREO
 
 let isPhone = () => imu.alpha != null;
 
 let drawScene = drawScene => {
   //  if (! isPhone()) {
       drawScene();
      //  return;
   //  }
    
   //  if (imu.alpha0 === undefined)
   //     imu.alpha0 = imu.alpha;
   //  let isIPhone = navigator.userAgent.match(/iPhone/i);
   //  VM.S();
   //     if (navigator.userAgent.match(/iPhone/i)) {
   //        VM.turnX(Math.PI/180 *  imu.gamma - Math.PI/2)
   //          .turnZ(Math.PI/180 * -imu.beta)
   //          .turnY(Math.PI/180 * (imu.alpha - imu.alpha0) + (Math.abs(imu.beta) > 90 ? Math.PI : 0));
   //     }
   //     else {
   //        VM.turnX(Math.PI/180 *  imu.gamma + Math.PI/2)
   //          .turnZ(Math.PI/180 *  imu.beta)
   //          .turnY(Math.PI/180 * (imu.alpha0 - imu.alpha));
   //     }
   //     for (let eye = -1 ; eye <= 1 ; eye += 2) {
   //        gl.uniform1f(uEye, eye);
   //        drawScene();
   //     }
   //  VM.R();
 }
 
 
// CUBIC SPLINES

let generateSpline = (points, n) => {
   let l = points.length - 1;
   if (l < 1) return;
   n = n * l;

   let controlPointsX = [],
   controlPointsZ = [],
   controlPointsY = [],
   splinePoints = [];

   points.forEach(point => {
        controlPointsX.push(point[0]);
        controlPointsY.push(point[1]);
        controlPointsZ.push(point[2]);
   });

   for (var i = 0; i < n; i += 1) {
      let splinePointX = catmullRom(controlPointsX, i/n);
      let splinePointY = catmullRom(controlPointsY, i/n);
      let splinePointZ = catmullRom(controlPointsZ, i/n);
      splinePoints.push( [splinePointX, splinePointY, splinePointZ] );
   }
   // add last point
   splinePoints.push( [controlPointsX[l], controlPointsY[l], controlPointsZ[l]] );

   return splinePoints
}