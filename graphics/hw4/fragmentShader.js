let fragmentShader =`
    precision highp float;

    const float EPS = 0.0000000001;
    const float INF = 10000000000.;

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
    uniform float uTime, uFL, uMedium;
    uniform int uReflective[`+NQ+`];
    uniform float uRefractive[`+NQ+`];
    uniform vec3 uV, uW, uUp, uRight, uCursor;
    uniform vec3 uL[2];
    varying vec3 vPos;

    vec3 bgColor = vec3(0.,0.,.05);

    vec2 rayTrace(vec3 V, vec3 W, float a, float b, float c,
                float d, float e, float f, float g, float h,
                float i, float j) {
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
        if (rad > 0.) return vec2(temp - sqrt(rad), temp + sqrt(rad));
        return vec2(-1., -1.);
    }

    vec3 shootRay(vec3 V, vec3 W, float current_n, float tMin) {
        vec3 color = vec3(0.);
        for (int bounces=0; bounces<`+MAX_BOUNCES+`; bounces++) {
            for (int obj = 0 ; obj < `+NQ+` ; obj++) {
                mat4 Q1 = uA[obj],
                     Q2 = uB[obj],
                     Q3 = uC[obj];
                float n = uRefractive[obj];
                int ref = uReflective[obj];

                float a = Q1[0].x,
                    b = Q1[1].y,
                    c = Q1[2].z,
                    d = Q1[2].y+Q1[1].z,
                    e = Q1[2].x+Q1[0].z,
                    f = Q1[1].x+Q1[0].y,
                    g = Q1[3].x+Q1[0].w,
                    h = Q1[3].y+Q1[1].w,
                    i = Q1[3].z+Q1[2].w,
                    j = Q1[3].w;
                vec2 t1 = rayTrace(V, W, a, b, c, d, e, f, g, h, i, j);
                a = Q2[0].x,
                b = Q2[1].y,
                c = Q2[2].z,
                d = Q2[2].y+Q2[1].z,
                e = Q2[2].x+Q2[0].z,
                f = Q2[1].x+Q2[0].y,
                g = Q2[3].x+Q2[0].w,
                h = Q2[3].y+Q2[1].w,
                i = Q2[3].z+Q2[2].w,
                j = Q2[3].w;
                vec2 t2 = rayTrace(V, W, a, b, c, d, e, f, g, h, i, j);
                a = Q3[0].x,
                b = Q3[1].y,
                c = Q3[2].z,
                d = Q3[2].y+Q3[1].z,
                e = Q3[2].x+Q3[0].z,
                f = Q3[1].x+Q3[0].y,
                g = Q3[3].x+Q3[0].w,
                h = Q3[3].y+Q3[1].w,
                i = Q3[3].z+Q3[2].w,
                j = Q3[3].w;
                vec2 t3 = rayTrace(V, W, a, b, c, d, e, f, g, h, i, j);

                float tin  = max(t1.x, max(t2.x, t3.x)),
                      tout = min(t1.y, min(t2.y, t3.y));

                if (tin < tout && tin > 0. && tin < tMin) {
                    tMin = tin;
                    vec3 P = V + tin * W;
                    float x = P.x,
                          y = P.y,
                          z = P.z;
                    vec3 N = normalize(vec3( 2.*a*x + e*z + f*y + g,
                                            2.*b*y + d*z + f*x + h,
                                            2.*c*z + d*y + e*x + i ) );
                    color += vec3(.2, .2, .8) + max(0., dot(N, uL[0]));

                    if (n != current_n) {
                        vec3 C = dot(N, W) * N,
                             S = W - C,
                             Sp = current_n/n * S,
                             Cp = (-1.)*sqrt(1.-Sp*Sp) * N,
                             Wp = Cp + Sp;
                        P = P + EPS*Wp;
                        W = normalize(Wp);
                        current_n = n;
                    }
                    else if (ref == 1) {
                        W = normalize(W - 2.*dot(N,W)*N);
                        P = P + EPS*W;
                    }
                    else {break;}
                }
            }
        }
        return color;
    }

    void main() {

        vec3 V = uV.xyz;
        vec3 W = normalize(vPos.x * uRight + vPos.y * uUp + uW);
        float tMin = INF;
        vec3 color = bgColor; 
        if (uCursor.z > 0.) {
            color += vec3(.5,.5,.5);
        }

        color += shootRay(V, W, uMedium, tMin);
        
        gl_FragColor = vec4(sqrt(color), 1.0);
    }
`;