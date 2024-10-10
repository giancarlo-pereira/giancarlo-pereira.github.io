let fragmentShader =`
    precision highp float;

    float noise(vec3 point) { float r = 0.; for (int i=0;i<16;i++) {
      vec3 D, p = point + mod(vec3(i,i/4,i/8) , vec3(4.0,2.0,2.0)) +
           1.7*sin(vec3(i,5*i,8*i)), C=floor(p), P=p-C-.5, A=abs(P);
      C += mod(C.x+C.y+C.z,2.) * step(max(A.yzx,A.zxy),A) * sign(P);
      D=34.*sin(987.*float(i)+876.*C+76.*C.yzx+765.*C.zxy);P=p-C-.5;
      r+=sin(6.3*dot(P,fract(D)-.5))*pow(max(0.,1.-2.*dot(P,P)),4.);
    } return .5 * sin(r); }
     
    float turbulence(vec3 P) {
       float f = 0., s = 1.;
       for (int i = 0 ; i < 4 ; i++) {
          f += abs(noise(s * P)) / s;
          s *= 2.;
          P = vec3(.866*P.x + .5*P.z, P.y + 100., -.5*P.x + .866*P.z);
       }
       return f;
    }

    uniform mat4 uA[`+NQ+`], uB[`+NQ+`], uC[`+NQ+`];
    uniform float uTime, uFL;
    uniform vec3 uV, uW, uUp, uRight, uL, uCursor;
    varying vec3 vPos;

    vec3 bgColor = vec3(0.,0.,.05);

    vec2 rayTrace(vec3 V, vec3 W, float a, float b, float c,
                  float d, float e, float f, float g, float h,
                  float i, float j) {
        vec2 t  = vec2(-1., -1.);
        float Vx = V.x,
              Vy = V.y,
              Vz = V.z;
        float Wx = W.x,
              Wy = W.y,
              Wz = W.z;

        float A   = 	a*Wx*Wx + b*Wy*Wy + c*Wz*Wz + d*Wy*Wz + e*Wz*Wx + f*Wx*Wy;
        float B   = 	2.*(a*Vx*Wx+b*Vy*Wy+c*Vz*Wz)+d*(Vy*Wz+Vz*Wy)+e*(Vz*Wx+Vx*Wz)+f*(Vx*Wy+Vy*Wx)+g*Wx+h*Wy+i*Wz;
        float C   = 	a*Vx*Vx + b*Vy*Vy + c*Vz*Vz + d*Vy*Vz + e*Vz*Vx + f*Vx*Vy + g*Vx + h*Vy + i*Vz + j; 

        float rad = B*B - 4.*A*C;
        if (rad > 0.) {
            t.x = - B + sqrt(rad);
            t.y = - B - sqrt(rad);
        } 
        return t;
    }

    void main() {

        vec3 V = uV.xyz;
        vec3 W = normalize(vPos.x * uRight + vPos.y * uUp + uW);
        float tMin = 1000.;
        vec3 color = bgColor; 
        if (uCursor.z > 0.) {
            color += vec3(.5,.5,.5);
        }

        // In the fragment shader main(), these values can be access like this:

        for (int o = 0 ; o < `+NQ+` ; o++) {
            mat4 Q = uA[o];
            mat4 Q2 = uB[o];
            mat4 Q3 = uC[o];

            float a = Q[0].x,
                    b = Q[1].y,
                    c = Q[2].z,
                    d = Q[2].y+Q[1].z,
                    e = Q[2].x+Q[0].z,
                    f = Q[1].x+Q[0].y,
                    g = Q[3].x+Q[0].w,
                    h = Q[3].y+Q[1].w,
                    i = Q[3].z+Q[2].w,
                    j = Q[3].w;
            
            vec2 t = rayTrace(V, W, a, b, c, d, e, f, g, h, i, j);
            float tin  = t.x,
                    tout = t.y;

            if (tin < tout && tin > 0. && tin < tMin) {
                tMin = tin;
                vec3 P = V + tin * W;
                float x = P.x,
                      y = P.y,
                      z = P.z;
                vec3 N = normalize(vec3( 2.*a*x + e*z + f*y + g,
                                            2.*b*y + d*z + f*x + h,
                                            2.*c*z + d*y + e*x + i ) );
                color = vec3(.2, .2, .8) + max(0., dot(N, uL));
            }
        }
        
        gl_FragColor = vec4(sqrt(color), 1.0);
    }
`;