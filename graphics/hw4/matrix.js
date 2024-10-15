let identity    = ()      => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
let translation = (x,y,z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
let rotationX   = t       => {
    let c = Math.cos(t),
        s = Math.sin(t);
        return [ 1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
};
let rotationY   = t       => {
    let c = Math.cos(t),
        s = Math.sin(t);
    return [ c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
};
let rotationZ   = t        => {
    let c = Math.cos(t),
        s = Math.sin(t);
    return [ c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
};

let scale      = (x,y,z)  => [ x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1];
let multiply   = (a,b)    => {
    let ta = transpose(a);
    let a1 = _x(ta),
        a2 = _y(ta),
        a3 = _z(ta),
        a4 = _w(ta),      
        b1 = _x(b),
        b2 = _y(b),
        b3 = _z(b),
        b4 = _w(b);

    return [dot(a1, b1), dot(a2, b1), dot(a3, b1), dot(a4, b1),
            dot(a1, b2), dot(a2, b2), dot(a3, b2), dot(a4, b2),
            dot(a1, b3), dot(a2, b3), dot(a3, b3), dot(a4, b3),
            dot(a1, b4), dot(a2, b4), dot(a3, b4), dot(a4, b4)];
};
let transpose  = m        => [ m[0],m[4],m[8],m[12], m[1],m[5],m[9],m[13], m[2],m[6],m[10],m[14], m[3],m[7],m[11],m[15]];
let dot        = (a,b)    => {
    if (b.length < 4) b[3] = 1;
    return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
};
let matvec     = (m,a)    => {
    let tm = transpose(m);
    let m1 = _x(tm),
        m2 = _y(tm),
        m3 = _z(tm),
        m4 = _w(tm);
    return [dot(m1, a), dot(m2, a), dot(m3, a), dot(m4, a)];
};
let _x         = m        => [ m[0],  m[1],  m[2],  m[3]];
let _y         = m        => [ m[4],  m[5],  m[6],  m[7]];
let _z         = m        => [ m[8],  m[9], m[10], m[11]];
let _w         = m        => [m[12], m[13], m[14], m[15]];