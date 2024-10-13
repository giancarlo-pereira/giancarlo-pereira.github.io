let fragmentShader =`
    precision highp float;

    // DEFINE CONSTANTS
    const float EPS = pow(.1, 8.);
    const float INF = pow(10., 8.);

    // NOISE FUNCTIONS
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

    // OBJECT DATA
    uniform mat4 uA[`+NQ+`], uB[`+NQ+`], uC[`+NQ+`];
    uniform float uReflective[`+NQ+`], uRefractive[`+NQ+`];
    uniform vec3 uColors[`+NQ+`];

    uniform float uTime, uFL, uMedium;
    uniform vec3 uV, uW, uUp, uRight, uCursor;
    uniform vec3 uL[2];
    varying vec3 vPos;

    vec3 bgColor = vec3(0.,0.,.05);

    // LOGIC FOR RAY TRACING
    vec3 reflection(vec3 W, vec3 N) {
        return W - 2. * dot(N, W) * N;    
    }
        
    vec3 surfaceNormal(mat4 Q, vec3 P) {
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
        float x = P.x,
              y = P.y,
              z = P.z;
        
        return vec3( 2.*a*x + e*z + f*y + g,
                     2.*b*y + d*z + f*x + h,
                     2.*c*z + d*y + e*x + i);
    }

    vec2 rayTrace(vec3 V, vec3 W, mat4 Q) {
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
        float Vx = V.x,
              Vy = V.y,
              Vz = V.z,
              Wx = W.x,
              Wy = W.y,
              Wz = W.z;

        float A = a*Wx*Wx + b*Wy*Wy + c*Wz*Wz + d*Wy*Wz + e*Wz*Wx + f*Wx*Wy;
        if (abs(A) < EPS) return vec2(-INF, INF); // dealing with 'everywhere'
        float B = 2.*(a*Vx*Wx + b*Vy*Wy + c*Vz*Wz) + d*(Vy*Wz + Vz*Wy) + e*(Vz*Wx + Vx*Wz) + f*(Vx*Wy + Vy*Wx) + g*Wx + h*Wy + i*Wz;
        float C = a*Vx*Vx + b*Vy*Vy + c*Vz*Vz + d*Vy*Vz + e*Vz*Vx + f*Vx*Vy + g*Vx + h*Vy + i*Vz + j;
        float temp = - B / (2.*A);
        float rad = temp*temp - C/A;
        if (rad > 0.) return vec2(temp - sqrt(rad), temp + sqrt(rad)); // intersections
        return vec2(-1., -1.); // no intersection
    }

    vec3 shootRay(vec3 V, vec3 W) {
        vec3 finalColor = vec3(0.),
             localColor = vec3(0.),
             N          = vec3(0.),   
             P          = V       ,
             Wp         = W       ;
        float tMin = INF;
        float frac = 1.;
        float currentMedium = uMedium,
              newMedium     = uMedium,
              objRef        = 0.     ;
        int hit = 0, inside = -1;
        for (int bounces=0; bounces<`+MAX_BOUNCES+`; bounces++) {
            hit = 0;
            objRef = 0.;
            if (frac < 0.05) { break; }
            for (int obj = 0; obj < `+NQ+`; obj++) {
                mat4 Q;
                mat4 Q1 = uA[obj],
                     Q2 = uB[obj],
                     Q3 = uC[obj];

                vec2 t1 = rayTrace(V, W, Q1);
                vec2 t2 = rayTrace(V, W, Q2);
                vec2 t3 = rayTrace(V, W, Q3);

                float tin  = max(t1.x, max(t2.x, t3.x)),
                      tout = min(t1.y, min(t2.y, t3.y));

                float t = tin;
                if      (abs(t1.x - tin) < EPS) Q = Q1;
                else if (abs(t2.x - tin) < EPS) Q = Q2;
                else                         Q = Q3;
        
                if (inside == 1) {
                    t = tout;
                    if      (abs(t1.y - tout) < EPS) Q = Q1;
                    else if (abs(t2.y - tout) < EPS) Q = Q2;
                    else                          Q = Q3;
                }

                if (tin < tout && t > 0. && t < tMin) {
                    hit = 1;                                        // ray hit an object
                    tMin = t;
                    newMedium = uRefractive[obj];
                    if (inside == 1) newMedium = uMedium;
                    objRef = uReflective[obj];
                    P = V + t * W;
                    N = normalize(surfaceNormal(Q, P));
                    localColor = uColors[obj];
                }
            }
            
            if (hit == 1) {                                         // ray hit an object
                if ( abs(newMedium - currentMedium) > EPS ) {       // refraction happening
                    vec3 S = W - dot(N, W) * N, 
                         Sp = currentMedium/newMedium * S;
                    if (dot(Sp,Sp) > 1.) {                          // total internal reflection
                        Wp = reflection(W, N);
                    }                          
                    else {
                        Wp = float(inside)*sqrt(1.-dot(Sp,Sp)) * N + Sp;
                        currentMedium = newMedium;
                        inside = (-1)*inside;
                        // finalColor = mix(finalColor, frac*localColor, 0.01);
                        // frac *= 0.99;   
                    }
                }
                else if (objRef > EPS) {                            // reflection happening
                    Wp = reflection(W, N);
                    finalColor = mix(finalColor, frac*localColor, 1.-objRef);   
                    frac *= objRef;
                }
                else {                                              // solid object hit
                    finalColor = mix(finalColor, frac*(localColor + max(0., dot(N, uL[0]))) , 0.9);
                    break;
                }                                       

                W = normalize(Wp);
                V = P + EPS*W;
            }
        }
        return finalColor;
    }

    // MAIN FUNCTION
    void main() {

        vec3 V = uV.xyz;
        vec3 W = vPos.x * uRight + vPos.y * uUp + uW;
        vec3 color = bgColor; 
        if (uCursor.z > 0.) {
            color += vec3(.5,.5,.5);
        }

        // ANTIALIASING
        color += shootRay(V, normalize(W));
        color += shootRay(V, normalize(W+uRight/float(`+numPixel+`)));
        color += shootRay(V, normalize(W-uRight/float(`+numPixel+`)));
        color += shootRay(V, normalize(W+uUp/float(`+numPixel+`)));
        color += shootRay(V, normalize(W-uUp/float(`+numPixel+`)));

        color /= 5.;
        
        gl_FragColor = vec4(sqrt(color), 1.0);
    }
`;