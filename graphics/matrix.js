function Matrix() {
   this.identity    = ()      => value = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
   this.translate   = (x,y,z) => value = multiply(value, [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
   this.rotateX     = theta   => {
      // You need to implement this.
      let c = Math.cos(theta),
          s = Math.sin(theta);
      value = multiply(value, [ 1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
   } 
   this.rotateY     = theta   => {
      // You need to implement this.
      let c = Math.cos(theta),
          s = Math.sin(theta);
      value = multiply(value, [ c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
   } 
   this.rotateZ     = theta   => {
      // You need to implement this.
      let c = Math.cos(theta),
          s = Math.sin(theta);
      value = multiply(value, [ c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
   } 
   this.scale       = (x,y,z) => {
      // You need to implement this.
      value = multiply(value, [ x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
   } 
   this.perspective = (x,y,z) => {
      // You need to implement this.
      value = multiply(value, [ 1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1]);
   } 
   this.get         = ()      => value;
   this.set         = v       => value = v;

   this.transform   = vector  => {
      // You need to implement this.
      let tm = _transpose(value);
      let m1 = _column1(tm),
          m2 = _column2(tm),
          m3 = _column3(tm),
          m4 = _column4(tm);
      return [_dot(m1, vector), _dot(m2, vector), _dot(m3, vector), _dot(m4, vector)]
   }

   let value = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

   let multiply = (matrix1,matrix2) => {
      // You need to implement this.
      let tm1 = _transpose(matrix1);
      let m11 = _column1(tm1);
          m12 = _column2(tm1),
          m13 = _column3(tm1),
          m14 = _column4(tm1),      
          m21 = _column1(matrix2),
          m22 = _column2(matrix2),
          m23 = _column3(matrix2),
          m24 = _column4(matrix2);

      return [_dot(m11, m21), _dot(m12, m21), _dot(m13, m21), _dot(m14, m21),
              _dot(m11, m22), _dot(m12, m22), _dot(m13, m22), _dot(m14, m22),
              _dot(m11, m23), _dot(m12, m23), _dot(m13, m23), _dot(m14, m23),
              _dot(m11, m24), _dot(m12, m24), _dot(m13, m24), _dot(m14, m24)]
   }
   
   let _transpose   = m       => [m[0],m[4],m[8],m[12], m[1],m[5],m[9],m[13], m[2],m[6],m[10],m[14], m[3],m[7],m[11],m[15]];
   let _dot         = (a,b)   => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
   let _column1     = m       => [m[0], m[1], m[2], m[3]];
   let _column2     = m       => [m[4], m[5], m[6], m[7]];
   let _column3     = m       => [m[8], m[9], m[10], m[11]];
   let _column4     = m       => [m[12], m[13], m[14], m[15]];
}