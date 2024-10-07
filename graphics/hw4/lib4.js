//////////////////////////////////////////////////////////////////////////////////////////
//
// THIS IS THE SUPPORT LIBRARY.  YOU PROBABLY DON'T WANT TO CHANGE ANYTHING HERE JUST YET.
//
//////////////////////////////////////////////////////////////////////////////////////////

let fragmentShaderHeader = [''                      // WHATEVER CODE WE WANT TO PREDEFINE FOR FRAGMENT SHADERS
    ,'precision highp float;'
    ,'float noise(vec3 point) { float r = 0.; for (int i=0;i<16;i++) {'
    ,'  vec3 D, p = point + mod(vec3(i,i/4,i/8) , vec3(4.0,2.0,2.0)) +'
    ,'       1.7*sin(vec3(i,5*i,8*i)), C=floor(p), P=p-C-.5, A=abs(P);'
    ,'  C += mod(C.x+C.y+C.z,2.) * step(max(A.yzx,A.zxy),A) * sign(P);'
    ,'  D=34.*sin(987.*float(i)+876.*C+76.*C.yzx+765.*C.zxy);P=p-C-.5;'
    ,'  r+=sin(6.3*dot(P,fract(D)-.5))*pow(max(0.,1.-2.*dot(P,P)),4.);'
    ,'} return .5 * sin(r); }'
    ,'float turbulence(vec3 P) {'
    ,'   float f = 0., s = 1.;'
    ,'   for (int i = 0 ; i < 4 ; i++) {'
    ,'      f += abs(noise(s * P)) / s;'
    ,'      s *= 2.;'
    ,'      P = vec3(.866*P.x + .5*P.z, P.y + 100., -.5*P.x + .866*P.z);'
    ,'   }'
    ,'   return f;'
    ,'}'
    ].join('\n');
    
    let nfsh = fragmentShaderHeader.split('\n').length; // NUMBER OF LINES OF CODE IN fragmentShaderHeader
    
    let isFirefox = navigator.userAgent.indexOf('Firefox') > 0;         // IS THIS THE FIREFOX BROWSER?
    let errorMsg = '';
    
    let initEventHandlers = canvas => {
       // RESPOND TO KEYBOARD EVENTS
    
       window.addEventListener("keydown", e => {
           if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0)
               e.preventDefault();
       });
       window.addEventListener('keydown', e => canvas.keyDown(e.code));
       window.addEventListener('keyup', e => canvas.keyUp(e.code));
       if (!canvas.keyDown)
           canvas.keyDown = () => {}
       if (!canvas.keyUp)
           canvas.keyUp = () => {}
    }
    
    function gl_start(canvas, vertexShader, fragmentShader) {           // START WEBGL RUNNING IN A CANVAS
       initEventHandlers(canvas);
       
       setTimeout(function() {
          try { 
             canvas.gl = canvas.getContext('experimental-webgl');              // Make sure WebGl is supported.
          } catch (e) { throw 'Sorry, your browser does not support WebGL.'; }
    
          canvas.setShaders = function(vertexShader, fragmentShader) {         // Add the vertex and fragment shaders:
    
             let gl = this.gl, program = gl.createProgram();                        // Create the WebGL program.
    
             function addshader(type, src) {                                        // Create and attach a WebGL shader.
               let shader = gl.createShader(type);
               gl.shaderSource(shader, src);
               gl.compileShader(shader);
               if (! gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                  throw "Cannot compile shader:\n\n" + gl.getShaderInfoLog(shader);
               gl.attachShader(program, shader);
             };
    
             addshader(gl.VERTEX_SHADER  , vertexShader  );                         // Add the vertex and fragment shaders.
             addshader(gl.FRAGMENT_SHADER, fragmentShaderHeader + fragmentShader);
    
             gl.linkProgram(program);                                               // Link the program, report any errors.
             if (! gl.getProgramParameter(program, gl.LINK_STATUS))
                console.log('Could not link the shader program!');
             gl.useProgram(program);
          gl.program = program;
    
             gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());                     // Create a square as a triangle strip
             gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(                       //    consisting of two triangles.
                            [ -1,1,0, 1,1,0, -1,-1,0, 1,-1,0 ]), gl.STATIC_DRAW);
    
             let aPos = gl.getAttribLocation(program, 'aPos');                      // Set aPos attribute for each vertex.
             gl.enableVertexAttribArray(aPos);
             gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
          }
    
          canvas.setShaders(vertexShader, fragmentShader);                     // Initialize everything,
    
          setInterval(function() {                                             // Start the animation loop.
             gl = canvas.gl;
             if (gl.startTime === undefined)                                            // First time through,
                gl.startTime = Date.now();                                              //    record the start time.
             animate(gl);
             gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);                                    // Render the square.
          }, 30);
    
       }, 100); // Wait 100 milliseconds after page has loaded before starting WebGL.
    }
    
    // THE animate() CALLBACK FUNCTION CAN BE REDEFINED IN index.html.
    
    function animate() { }
    
    let gl;
    function setUniform(type, name, a, b, c, d, e, f) {
       let loc = gl.getUniformLocation(gl.program, name);
       (gl['uniform' + type])(loc, a, b, c, d, e, f);
    }
    
    