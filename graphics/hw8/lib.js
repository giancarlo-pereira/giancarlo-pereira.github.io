// CAMERA VIEW PARAMETERS
let fl=3;

// MATH CONSTANTS
let pi = Math.PI;
let C = t => Math.cos(t), S = t => Math.sin(t);

// ALGORITHM P TAKEN FROM
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


// MATRIX SUPPORT LIBRARY

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
let mId = () => [ 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1 ];
let mPe = (fl, m) => mxm(m, [1,0,0,0, 0,1,0,0, 0,0,1,-1/fl, 0,0,0,1]);
let mRX = (t, m) => mxm(m, [1,0,0,0, 0,C(t),S(t),0, 0,-S(t),C(t),0, 0,0,0,1]);
let mRY = (t, m) => mxm(m, [C(t),0,-S(t),0, 0,1,0,0, S(t),0,C(t),0, 0,0,0,1]);
let mRZ = (t, m) => mxm(m, [C(t),S(t),0,0, -S(t),C(t),0,0, 0,0,1,0, 0,0,0,1]);
let mSc = (x,y,z, m) => mxm(m, [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
let mTr = (x,y,z, m) => mxm(m, [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
function Matrix() {
   let stack = [mId()], top = 0;
   let set = arg => { stack[top] = arg; return this; }
   let get = () => stack[top];
   this.identity = () => set(mId());
   this.perspective = fl => set(mPe(fl, get()));
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
      let Q = p(u+.001,v);
      let x = Q[0]-P[0], y = Q[1]-P[1], z = Q[2]-P[2], s = Math.sqrt(x*x + y*y + z*z);
      return P.concat([u, 1-v, x/s, y/s, z/s]);
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
   return [ x,y,z, x,y,z ];
});
let tube = (nu, nv) => createMesh(nu, nv, (u,v) => {
   let x = C(2 * Math.PI * u),
       y = S(2 * Math.PI * u),
       z = 2 * v - 1;
   return [ x,y,z, x,y,0 ];
});
let disk = (nu, nv) => createMesh(nu, nv, (u,v) => {
   let x = v * C(2 * Math.PI * u),
       y = v * S(2 * Math.PI * u);
   return [ x,y,0, 0,0,1 ];
});
let cylinder = (nu, s) => createMesh(nu, 6, (u,v) => {
   s = s ? s : 1;
   let x = C(2 * Math.PI * u),
       y = S(2 * Math.PI * u);
   switch (5 * v >> 0) {
   case 0: return [ 0,0,-1, 0,0,-1 ];
   case 1: return [ x,y,-1, 0,0,-1 ];
   case 2: return [ x,y,-1, x,y, 0 ];
   case 3: return [ s*x,s*y, 1, x,y, 0 ];
   case 4: return [ s*x,s*y, 1, 0,0, 1 ];
   case 5: return [ 0,0, 1, 0,0, 1 ];
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
   return [ x,y,z, cp*ct,cp*st,sp ];
});
let strToTris = s => {
   let t = [], i;
   for (let n = 0 ; n < s.length ; n++)
      if ((i = 'N01'.indexOf(s.charAt(n))) >= 0)
         t.push(i-1);
   return new Float32Array(t);
}

let triangle = strToTris(`1N000111100 11000110100 N1000100100`);

let square = strToTris(`1N000111100 11000110100 N1000100100  N1000100100 NN000101100 1N000111100`);

let cube = strToTris(`1N100111100 11100110100 N1100100100  N1100100100 NN100101100 1N100111100
                      N1N00N01N00 11N00N11N00 1NN00N10N00  1NN00N10N00 NNN00N00N00 N1N00N01N00
                      11N10011010 11110010010 1N110000010  1N110000010 1NN10001010 11N10011010
                      NN1N00100N0 N11N00000N0 N1NN00010N0  N1NN00010N0 NNNN00110N0 NN1N00100N0
                      N1101011001 11101010001 11N01000001  11N01000001 N1N01001001 N1101011001
                      1NN0N00100N 1N10N01100N NN10N01000N  NN10N01000N NNN0N00000N 1NN0N00100N`);

// API FOR ACCESSING 3D SHAPES

let Cube     = ()      => { return { type: 0, mesh: cube }; }
let Cylinder = (n,s)   => { return { type: 1, mesh: cylinder(n,s) }; }
let Disk     = n       => { return { type: 1, mesh: disk    (n, 1) }; }
let Sphere   = n       => { return { type: 1, mesh: sphere  (n, n>>1) }; }
let Square   = ()      => { return { type: 0, mesh: square }; }
let Triangle = ()      => { return { type: 0, mesh: triangle }; }
let Torus    = (n,r,t) => { return { type: 1, mesh: torus   (n, n, r, t) }; }
let Tube     = n       => { return { type: 1, mesh: tube    (n, 1) }; }

// GPU SHADERS

let vertexSize = 11;
let vertexShader = `
   attribute vec3 aPos, aNor, aTan;
   attribute vec2 aUV;
   uniform mat4 uMatrix, uInvMatrix;
   varying vec3 vPos, vNor, vTan;
   varying vec2 vUV;
   void main() {
      vec4 pos = uMatrix * vec4(aPos, 1.0);
      vec4 nor = vec4(aNor, 0.0) * uInvMatrix;
      vec4 tan = vec4(aTan, 0.0) * uInvMatrix;
      vPos = pos.xyz;
      vNor = nor.xyz;
      vTan = tan.xyz;
      vUV  = aUV;
      gl_Position = pos * vec4(1.,1.,-.1,1.);
   }
`;
let fragmentShader = `
   precision mediump float;
   uniform sampler2D uSampler[16];
   uniform vec3 uColor;
   uniform float uOpacity;
   uniform int uTexture, uBumpTexture;
   varying vec3 vPos, vNor, vTan;
   varying vec2 vUV;

   // LIGHTING
   float attenuation(vec3 P, vec3 uLight) {
      vec3 dist = uLight - P;
      return 1. / dot(dist, dist); 
   }

   float diffuse(vec3 N, vec3 P, vec3 uLight) {
      vec3 surfToLight = normalize(uLight - P);
      return max(0., dot(N, surfToLight));
   }

   void main(void) {
      vec3 uL = vec3(-1., 3., `+ -fl +`);
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

      float att = 50.*attenuation(vPos, uL),
         diff = diffuse(nor, vPos, uL);
            
      float c = att*(0.05+diff);
      vec3 color = sqrt(uColor * c) * texture.rgb;
      gl_FragColor = vec4(color, uOpacity * texture.a);
   }
`;

// DECLARE GL-RELATED VARIABLES AND MATRIX OBJECT

let gl = start_gl(canvas1, vertexShader, fragmentShader);
let uColor       = gl.getUniformLocation(gl.program, "uColor"      );
let uInvMatrix   = gl.getUniformLocation(gl.program, "uInvMatrix"  );
let uMatrix      = gl.getUniformLocation(gl.program, "uMatrix"     );
let uOpacity     = gl.getUniformLocation(gl.program, "uOpacity"    );
let uSampler     = gl.getUniformLocation(gl.program, "uSampler"    );
let uTexture     = gl.getUniformLocation(gl.program, "uTexture"    );
let uBumpTexture = gl.getUniformLocation(gl.program, "uBumpTexture");
let M = new Matrix();

gl.uniform1iv(uSampler, [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);

// LOAD A TEXTURE IMAGE

let animatedSource = [];

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
   gl.uniform3fv      (uColor      , color );
   gl.uniformMatrix4fv(uInvMatrix  , false, mInverse(M.get()));
   gl.uniformMatrix4fv(uMatrix     , false, M.get()          );
   gl.bufferData(gl.ARRAY_BUFFER, Shape.mesh, gl.STATIC_DRAW);
   gl.drawArrays(Shape.type ? gl.TRIANGLE_STRIP : gl.TRIANGLES, 0, Shape.mesh.length / vertexSize);
   return M;
}

// BALLOON AND EXPLOSION FUNCTIONS

function Explosion() {
   let exploding = 0;
   let pos = [0.,0.,0.];
   let size = .005;
   let t = 0.;
   let trig = 0., thresh = 1.; //seconds

   this.where = () => pos;
   this.follow = p => {if (exploding==0) pos=p;}

   this.trigger = t => {
      trig = t;
      exploding = 1;
   }

   this.reset = () => {
      exploding=0;
   };

   this.render = t => {
      if (exploding==0) return;
      if (t-trig > thresh) {this.reset(); return;}
      let c = [normal_random(.7, .05),normal_random(.7, .05),normal_random(.7, .05)];
      for ( var i = 0; i < 100; i++ ) {
         M.S().move(normal_random(pos[0],.4*(1+(t-trig)**4)),normal_random(pos[1]-(t-trig)**2,.4*(1+(t-trig)**4)),normal_random(pos[2],.4*(1+(t-trig)**4))).turnZ(2*(Math.random()-.5)*pi).turnX(2*(Math.random()-.5)*pi).turnY(2*(Math.random()-.5)*pi).scale(size/(t-trig)).draw(Triangle(),c,1., -1, -1).R()
      }
   }
}

function Balloon() {
   let color = [.7,.7,.7], opacity = .95;
   let size = 0.5;
   let pos = [0.,0.,-fl];
   let angle = [pi/2,pi/2,pi/2];
   let a = [0.,0.,0.], alpha = [0.,0.,0.];
   let v = [.1, -.1, 0.], omega = [0.,0.,0.];
   let t = 0., moving = 0;
   let reset = 0., thresh = 4.; //seconds

   this.speed = () => v;
   this.where = () => pos;
   this.color = () => color;
   this.size  = () => size;

   let move = (dt) => {
      pos[0]=pos[0]+v[0]*dt+0.5*a[0]*dt**2;
      pos[1]=pos[1]+v[1]*dt+0.5*a[1]*dt**2;
      pos[2]=pos[2]+v[2]*dt+0.5*a[2]*dt**2;

      v[0]=v[0]+a[0]*dt;
      v[1]=v[1]+a[1]*dt;
      v[2]=v[2]+a[2]*dt;

      if (Math.abs(pos[0])      - 1.5 > 0) v[0] = -.9*v[0];
      if (Math.abs(pos[1])      - 1.5 > 0) v[1] = -.9*v[1];
      if (Math.abs(pos[2]+fl-1) -   1 > 0) v[2] = -.9*v[2];
   };

   let rotate = (dt) => {
      angle[0]=angle[0]+omega[0]*dt+0.5*alpha[0]*dt**2;
      angle[1]=angle[1]+omega[1]*dt+0.5*alpha[1]*dt**2;
      angle[2]=angle[2]+omega[2]*dt+0.5*alpha[2]*dt**2;

      omega[0]=omega[0]+alpha[0]*dt;
      omega[1]=omega[1]+alpha[1]*dt;
      omega[2]=omega[2]+alpha[2]*dt;
   }

   this.trigger = () => {
      moving = 1;
   };

   this.fly = (time) => {
      let dt = time - t;
      if (moving!=0) {
         a=[5*(Math.random()-.5), 5*(Math.random()-.5), 5*(Math.random()-.5)];
         alpha=[2*(Math.random()-.5), 2*(Math.random()-.5), 2*(Math.random()-.5)];
      } else {
         a=[0.,0.,0.];
         v=[0.,0.,0.];
         pos=[.1*C(time/4)*S(time/4), -.1*S(time/4)*S(time/4), -fl];
         alpha=[0.,0.,0.];
         omega=[0.,0.,0.];
         angle=[pi/2,pi/2,pi/2];
      }
      move(  dt < 10**(-10) ? 0.01 : dt );
      rotate(dt < 10**(-10) ? 0.01 : dt );
      t=t+dt;
   };

   this.hit = (t,cursor) => {
      if (moving==0) return false;
      if (cursor[2]==0) return false;

      let x = -(pos[2]-fl)*cursor[0]/fl;
      let y = -(pos[2]-fl)*cursor[1]/fl;

      if ( (x-pos[0])**2 + (y-pos[1])**2 - size**2 < 0 ) {
         this.reset(t);
         return true;
      }
      return false;
   };

   this.reset = (t) => {
      reset = t;
      moving=0;
      a=[0.,0.,0.]
      v=[0.,0.,0.]
      omega=[0.,0.,0.]
      angle=[pi/2,pi/2,pi/2];
      pos=[0.,0.,-fl];
   };

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

// HANDLE CURSOR

let rect = canvas1.getBoundingClientRect(), cursor = [0,0,0];
let setCursor = (e, z) => cursor = [  2 * (e.clientX - rect.left) / canvas1.width  - 1,
                                     -2 * (e.clientY - rect.top + window.scrollY) / canvas1.height + 1,
                                     z !== undefined ? z : cursor[2] ];

canvas1.onmousedown = e => setCursor(e, 1);
canvas1.onmousemove = e => setCursor(e,  );
canvas1.onmouseup   = e => setCursor(e, 0);