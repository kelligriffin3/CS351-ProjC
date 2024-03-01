//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda
// became:
//
// ColoredMultiObject.js  MODIFIED for EECS 351-1, 
//									Northwestern Univ. Jack Tumblin
//    --converted from 2D to 4D (x,y,z,w) vertices
//    --demonstrate how to keep & use MULTIPLE colored shapes in just one
//			Vertex Buffer Object(VBO). 
//    --demonstrate 'nodes' vs. 'vertices'; geometric corner locations where
//				OpenGL/WebGL requires multiple co-located vertices to implement the
//				meeting point of multiple diverse faces.
//    --Simplify fcn calls: make easy-access global vars for gl,g_nVerts, etc.
//
// Vertex shader program----------------------------------
var VSHADER_SOURCE = 
 `uniform mat4 u_ModelMatrix;
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  varying vec4 v_Color;
  
  void main() {
    gl_Position = u_ModelMatrix * a_Position;
    gl_PointSize = 10.0;
    v_Color = a_Color;
  }`;

// Fragment shader program----------------------------------
var FSHADER_SOURCE = 				
 `precision mediump float;
  varying vec4 v_Color;
  void main() {
    gl_FragColor = v_Color;
  }`;

// Easy-Access Global Variables-----------------------------
// (simplifies function calls. LATER: merge them into one 'myApp' object)
var ANGLE_STEP_DIAMOND = 45.0;  // -- Rotation angle rate (degrees/second)
var ANGLE_STEP_ROBOT = 45.0;
var gl;                 // WebGL's rendering context; value set in main()
var g_nVerts;           // # of vertices in VBO; value set in main()
var hand_angle = 0;
var hand_direction = 1.0; // tracker var of hand
var diamond_angle = 0.0;
var diamond_direction = 1.0;
var diamond_x = 0.0;
var robot_angle = 0.0;
var robot_arm = 0.0;
var robot_leg = 0.0;
var robot_direction_leg = 1.0;
var robot_direction_arm = 1.0;
var robot_head = 0.0;
var robot_head_dir = 1.0;
var legBrake = 1.0;
var armBrake = 1.0;
var headBrake = 1.0;
var floatsPerVertex = 7;
var tower_angle = 0.0;
var tower_dir = 1.0;

// Vars for mouse drag
// var g_isDrag=false;		// mouse-drag: true when user holds down mouse button
// var g_xMclik=0.0;		// last mouse button-down position (in CVV coords)
// var g_yMclik=0.0;   
// var g_xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
// var g_yMdragTot=0.0; 
// var g_digits=5;	
var isDrag = false;
var xMclik = 0.0;
var yMclik = 0.0;
var yMdragTot = 0.0;
var xMdragTot = 0.0;

var myCanvas = document.getElementById('HTML5_canvas');
var modelMatrix = new Matrix4();
var uMatrix_Loc;

var num_ticks = 0;

// Vars for Quaternion movement
var qNew = new Quaternion(0,0,0,1); // most-recent mouse drag's rotation
var qTot = new Quaternion(0,0,0,1);	// 'current' orientation (made from qNew)
var quatMatrix = new Matrix4();	    // rotation matrix, made from latest qTot

// Vars to keep track where shapes start
var robot_start;
var star_start;
var hand_start;
var diamond_start;
var sphere_start;
var grid_start;
var tree_start;
var cylinder_start;
var tower_start;

var hand_nn;
var diamond_nn;
var person_nn;
var star_nn;
var grid_nn;
var sphere_nn;
var axis_nn;
var tree_nn;
var cylinder_nn;
var tower_nn;

// Vars for Camera moving
var eye_x = -5; 
var eye_y = 3.5;
var eye_z = 2.5;
var theta = -0.5;
var d_tilt = -0.3;
var aim_x = 0.0;
var aim_y = 0.0;
var aim_z = 0.0;
var z_far = 20.0;
var z_near = 1.0;

var finger_angle = -10.0;
var finger_dir = 1.0;

var hand_rot = 120;

function main() {
//==============================================================================
  // Retrieve <canvas> element we created in HTML file:
//   var myCanvas = document.getElementById('HTML5_canvas');

  gl = getWebGLContext(myCanvas);
  if (!gl) {
    console.log('Failed to get the WebGL rendering context from myCanvas');
    return;
  }

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Create a Vertex Buffer Object (VBO) in the GPU, and then fill it with
  // g_nVerts vertices. 
  g_nVerts = initVertexBuffer();
  if (g_nVerts < 0) {
    console.log('Failed to set the vertex information');
    return;
  }

	//Enable 3D depth-test when drawing: don't over-draw at any pixel 
	gl.enable(gl.DEPTH_TEST); 	  
	
  // Create, init current rotation angle value in JavaScript
  var currentAngle = 0.0;

  // Get handle to graphics system's storage location of u_ModelMatrix
  //var u_ModelLoc = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ModelLoc = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelLoc) { 
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }
  // Create a local version of our model matrix in JavaScript 
  // var modelMatrix = new Matrix4();

  window.addEventListener("keydown", myKeyDown, false);
  // After each 'keydown' event, call the 'myKeyDown()' function.  The 'false' 
  // arg (default) ensures myKeyDown() call in 'bubbling', not 'capture' stage)
  // ( https://www.w3schools.com/jsref/met_document_addeventlistener.asp )
  window.addEventListener("keyup", myKeyUp, false);

  window.addEventListener("mousedown", myMouseDown); 
	// (After each 'mousedown' event, browser calls the myMouseDown() fcn.)
  window.addEventListener("mousemove", myMouseMove); 
  window.addEventListener("mouseup", myMouseUp);	
  window.addEventListener("click", myMouseClick);				
  window.addEventListener("dblclick", myMouseDblClick); 
  
  // Initialize the matrix: 
  modelMatrix.setIdentity(); // (not req'd: constructor makes identity matrix)
  
  // Transfer modelMatrix values to the u_ModelMatrix variable in the GPU
   gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
   
//-----------------  DRAW STUFF!

  //---------------Interactive Animation: draw repeatedly
  // Create an endlessly repeated 'tick()' function by this clever method:
  // a)  Declare the 'tick' variable whose value is this function:
  var tick = function() {
    //currentAngle = animate(currentAngle);  // Update the rotation angle
	[hand_angle, hand_direction,diamond_angle, diamond_x, diamond_direction, robot_angle, robot_arm, robot_leg, robot_direction_leg, robot_direction_arm, robot_head, robot_head_dir, tower_angle, tower_dir] = animate_hand(hand_angle, hand_direction, diamond_angle, diamond_x, diamond_direction, robot_angle, robot_arm, robot_leg, robot_direction_leg, robot_direction_arm, robot_head, robot_head_dir, tower_angle, tower_dir)
	//[diamond_angle, diamond_x, diamond_direction] = animate_diamond(diamond_angle, diamond_x, diamond_direction); 
	//console.log("X:", diamond_x)
	//console.log("Robot:", robot_angle);
	draw(modelMatrix, u_ModelLoc, hand_angle, diamond_angle, diamond_x, robot_angle, robot_arm, robot_leg, robot_head, tower_angle); 
    requestAnimationFrame(tick, myCanvas);   
    									// Request that the browser re-draw the webpage
  };
  // AFTER that, call the function.
  //							// start (and continue) animation: 
  if (num_ticks == 0){
	drawResize();
	tick();
	num_ticks = num_ticks + 1;
  } else{
	num_ticks = num_ticks + 1;
	tick();
  }

}     

function initVertexBuffer() {
//==============================================================================

  makeGroundGrid();	
  makeSphere();
  makeCylinder();
  var c30 = Math.sqrt(0.75);			 
  var colorShapes = new Float32Array([
 
	 // +x face
     1.0, -1.0, -1.0, 1.0,		 0.8, 1.0, 0.8,	
     1.0,  1.0, -1.0, 1.0,		 0.0, 0.8, 0.0,	
     1.0,  1.0,  1.0, 1.0,	  0.0, 0.5, 0.0,
     
     1.0,  1.0,  1.0, 1.0,	  0.8, 1.0, 0.8,
     1.0, -1.0,  1.0, 1.0,	  0.0, 0.8, 0.0,
     1.0, -1.0, -1.0, 1.0,	  0.0, 0.5, 0.0,

	// +y face
    -1.0,  1.0, -1.0, 1.0,	  0.8, 1.0, 0.8,	
    -1.0,  1.0,  1.0, 1.0,	  0.0, 0.8, 0.0,	
     1.0,  1.0,  1.0, 1.0,	  0.0, 0.5, 0.0,	

     1.0,  1.0,  1.0, 1.0,	  0.8, 1.0, 0.8,	
     1.0,  1.0, -1.0, 1.0,	  0.0, 0.8, 0.0,
    -1.0,  1.0, -1.0, 1.0,	  0.0, 0.5, 0.0,

	// +z face
    -1.0,  1.0,  1.0, 1.0,	  0.8, 1.0, 0.8,
    -1.0, -1.0,  1.0, 1.0,	  0.0, 0.8, 0.0,
     1.0, -1.0,  1.0, 1.0,	  0.0, 0.5, 0.0,

     1.0, -1.0,  1.0, 1.0,	  0.8, 1.0, 0.8,	
     1.0,  1.0,  1.0, 1.0,	  0.0, 0.8, 0.0,	
    -1.0,  1.0,  1.0, 1.0,	  0.0, 0.5, 0.0,

	// -x face
    -1.0, -1.0,  1.0, 1.0,	  0.8, 1.0, 0.8,	
    -1.0,  1.0,  1.0, 1.0,	  0.0, 0.8, 0.0,
    -1.0,  1.0, -1.0, 1.0,	  0.0, 0.5, 0.0,
    
    -1.0,  1.0, -1.0, 1.0,	  0.8, 1.0, 0.8,
    -1.0, -1.0, -1.0, 1.0,	  0.0, 0.8, 0.0,  
    -1.0, -1.0,  1.0, 1.0,	  0.0, 0.5, 0.0,  
    
	// -y face
     1.0, -1.0, -1.0, 1.0,	  0.8, 1.0, 0.8,
     1.0, -1.0,  1.0, 1.0,	  0.0, 0.8, 0.0,
    -1.0, -1.0,  1.0, 1.0,	  0.0, 0.5, 0.0,

    -1.0, -1.0,  1.0, 1.0,	  0.8, 1.0, 0.8,
    -1.0, -1.0, -1.0, 1.0,	  0.0, 0.8, 0.0,
     1.0, -1.0, -1.0, 1.0,	  0.0, 0.5, 0.0,

     // -z face
     1.0,  1.0, -1.0, 1.0,	  0.8, 1.0, 0.8,
     1.0, -1.0, -1.0, 1.0,	  0.0, 0.8, 0.0,
    -1.0, -1.0, -1.0, 1.0,	  0.0, 0.5, 0.0,		

    -1.0, -1.0, -1.0, 1.0,	  0.8, 1.0, 0.8,	
    -1.0,  1.0, -1.0, 1.0,	  0.0, 0.8, 0.0,	
     1.0,  1.0, -1.0, 1.0,	  0.0, 0.5, 0.0,	

	 // DIAMOND VERTICES
	 0.0,  1.0,  0.0,  1.0,  1.0, 0.0, 0.0, 
	-1.0,  0.0,  0.0,  1.0,  0.0, 1.0, 0.0, 
	0.0,  0.0,  1.0,  1.0,  1.0, 0.0, 1.0, 

	0.0,  -1.0,  0.0,  1.0,  1.0, 0.0, 0.0,
	-1.0,  0.0,  0.0,  1.0,  1.0, 1.0, 0.0, 
	0.0,  0.0,  1.0,  1.0,  0.0, 0.0, 1.0, 

	0.0,  1.0,  0.0,  1.0, 1.0, 0.0, 0.0, 
	1.0,  0.0,  0.0,  1.0,  0.0, 1.0, 0.0,
	0.0,  0.0,  -1.0,  1.0,  0.0, 0.0, 1.0,

	0.0,  -1.0,  0.0,  1.0,  1.0, 0.0, 0.0,
	1.0,  0.0,  0.0,  1.0,  0.0,  1.0,  0.0,
	0.0,  0.0,  -1.0,  1.0,  0.0,  0.0,  1.0,

	0.0,  1.0,  0.0,  1.0,  1.0, 0.0, 0.0, 
	-1.0,  0.0,  0.0,  1.0,  0.0, 1.0, 0.0,
	0.0,  0.0,  -1.0,  1.0,  0.0, 0.0, 1.0,

	0.0,  -1.0,  0.0,  1.0,  1.0, 0.0, 0.0,
	1.0,  0.0,  0.0,  1.0,  0.0, 1.0, 0.0,
	0.0,  0.0,  1.0,  1.0,  0.0, 0.0, 1.0, 

	0.0,  -1.0,  0.0,  1.0,  1.0, 0.0, 0.0,
	-1.0,  0.0,  0.0,  1.0,  0.0, 1.0, 0.0,
	0.0,  0.0,  -1.0,  1.0,  0.0, 0.0, 1.0,

	0.0,  1.0,  0.0,  1.0,  1.0, 0.0, 0.0,
	1.0,  0.0,  0.0,  1.0,  0.0, 1.0, 0.0, 
	0.0,  0.0,  1.0,  1.0,  0.0, 0.0, 1.0, 

	// PERSON VERTICES
	// +x face: 
     1.0, -1.0, -1.0, 1.0,		 0.737, 0.325, 0.514,
     1.0,  1.0, -1.0, 1.0,		 1, 0.647, 0,
     1.0,  1.0,  1.0, 1.0,	  	 0, 0, 0.804,
     
     1.0,  1.0,  1.0, 1.0,	 0.737, 0.325, 0.514,
     1.0, -1.0,  1.0, 1.0,	  1, 0.647, 0,	
     1.0, -1.0, -1.0, 1.0,	  0, 0, 0.804,	

		// +y face: 
    -1.0,  1.0, -1.0, 1.0,	  0.737, 0.325, 0.514,
    -1.0,  1.0,  1.0, 1.0,	  1, 0.647, 0,
     1.0,  1.0,  1.0, 1.0,	  0, 0, 0.804,	

     1.0,  1.0,  1.0, 1.0,	  0.737, 0.325, 0.514,	
     1.0,  1.0, -1.0, 1.0,	  1, 0.647, 0,	
    -1.0,  1.0, -1.0, 1.0,	  0, 0, 0.804,

		// +z face: 
    -1.0,  1.0,  1.0, 1.0,	 0.737, 0.325, 0.514,	
    -1.0, -1.0,  1.0, 1.0,	  1, 0.647, 0,
     1.0, -1.0,  1.0, 1.0,	  0, 0, 0.804,	

     1.0, -1.0,  1.0, 1.0,	  0.737, 0.325, 0.514,
     1.0,  1.0,  1.0, 1.0,	  1, 0.647, 0,	
    -1.0,  1.0,  1.0, 1.0,	  0, 0, 0.804,	

		// -x face: 
    -1.0, -1.0,  1.0, 1.0,	  0.737, 0.325, 0.514,
    -1.0,  1.0,  1.0, 1.0,	  1, 0.647, 0, 
    -1.0,  1.0, -1.0, 1.0,	  0, 0, 0.804,	
    
    -1.0,  1.0, -1.0, 1.0,	  0.737, 0.325, 0.514,	
    -1.0, -1.0, -1.0, 1.0,	  1, 0.647, 0,	  
    -1.0, -1.0,  1.0, 1.0,	  0, 0, 0.804,	  
    
		// -y face: 
     1.0, -1.0, -1.0, 1.0,	  0.737, 0.325, 0.514,	
     1.0, -1.0,  1.0, 1.0,	  1, 0.647, 0,	
    -1.0, -1.0,  1.0, 1.0,	  0, 0, 0.804,

    -1.0, -1.0,  1.0, 1.0,	  0.737, 0.325, 0.514,
    -1.0, -1.0, -1.0, 1.0,	  1, 0.647, 0,
     1.0, -1.0, -1.0, 1.0,	  0, 0, 0.804,	

     // -z face: 
     1.0,  1.0, -1.0, 1.0,	  0.737, 0.325, 0.514,
     1.0, -1.0, -1.0, 1.0,	  1, 0.647, 0,	
    -1.0, -1.0, -1.0, 1.0,	  0, 0, 0.804,			

    -1.0, -1.0, -1.0, 1.0,	 0.737, 0.325, 0.514,	
    -1.0,  1.0, -1.0, 1.0,	  1, 0.647, 0,	
     1.0,  1.0, -1.0, 1.0,	  0, 0, 0.804,	

	 // STAR VERTICES

	// Face 0: (left side)  
     0.0,  0.0, 1.0, 1.0,		1.0, 	1.0,	1.0,	// Node 0 WHITE
     c30, -1.5, 0.0, 1.0, 		0.0,  0.0,  1.0, 	// Node 1 BLUE
     0.0,  1.0, 0.0, 1.0,  		1.0,  0.0,  0.0,	// Node 2  RED
	// Face 1: (right side)
	 0.0,  0.0, 1.0, 1.0,		1.0, 	1.0,	1.0,// Node 0 WHITE
     0.0,  1.0, 0.0, 1.0,  		1.0,  0.0,  0.0,	// Node 2 RED
    -c30, -1.5, 0.0, 1.0, 		0.0,  1.0,  0.0, 	// Node 3 GREEN

	0.0,  0.0, -1.0, 1.0,		1.0, 	1.0,	1.0,	// Node 0 WHITE
	c30, -1.5, 0.0, 1.0, 		0.0,  0.0,  1.0, 	// Node 1 BLUE
	0.0,  1.0, 0.0, 1.0,  		1.0,  0.0,  0.0,	// Node 2  RED

	0.0,  0.0, -1.0, 1.0,		1.0, 	1.0,	1.0,// Node 0 WHITE
	0.0,  1.0, 0.0, 1.0,  		1.0,  0.0,  0.0,	// Node 2 RED
   -c30, -1.5, 0.0, 1.0, 		0.0,  1.0,  0.0, 	// Node 3 GREEN

   0.0,  0.0, -1.0, 1.0,		1.0, 	1.0,	1.0,// Node 0 WHITE
   c30, -1.5, 0.0, 1.0, 		0.0,  0.0,  1.0, 	// Node 2 BLUE
   -c30, -1.5, 0.0, 1.0, 		0.0,  1.0,  0.0, 	// Node 3 GREEN

   0.0,  0.0, 1.0, 1.0,		1.0, 	1.0,	1.0,// Node 0 WHITE
   c30, -1.5, 0.0, 1.0, 		0.0,  0.0,  1.0, 	// Node 2 BLUE
   -c30, -1.5, 0.0, 1.0, 		0.0,  1.0,  0.0, 	// Node 3 GREEN

   // AXIS VERTICES
    // Drawing Axes: Draw them using gl.LINES drawing primitive;
	// +x axis RED; +y axis GREEN; +z axis BLUE; 
	 0.0,  0.0,  0.0, 1.0,		0.0,  1.0,  0.0,	// X axis line RED
	 1.3,  0.0,  0.0, 1.0,		0.0,  1.0,  0.0,
		 
	 0.0,  0.0,  0.0, 1.0,   	1.0,  0.0,  0.0,	  // Y axis line GREEN
	 0.0,  1.3,  0.0, 1.0,		1.0,  0.0,  0.0,	

	 0.0,  0.0,  0.0, 1.0,		0.0,  0.0,  1.0,	// Z axis line BLUE
	 0.0,  0.0,  1.3, 1.0,		0.0,  0.0,  1.0,

	// TREE Vertices
	0.00, 0.00, 0.00, 1.00, 1.0, 0.0, 0.0,  // first triangle   (x,y,z,w==1)
    0.10, 0.00, 0.00, 1.00, 0.8, 0.7, 0.8,
    0.10, 0.65, 0.00, 1.00, 0.5, 0.0, 0.5,
    0.00, 0.00, 0.00, 1.00, 1.0, 0.0, 0.0, 	// second triangle
    0.10, 0.65, 0.00, 1.00, 0.8, 0.7, 0.8,
    0.00, 0.65, 0.00, 1.00, 0.5, 0.0, 0.5,

  ]);

  var cubeVerts = new Float32Array([
 
	// +x face
	1.0, -1.0, -1.0, 1.0,		 0.188, 0, 0.188,	
	1.0,  1.0, -1.0, 1.0,		 0.502, 0, 0.502,
	1.0,  1.0,  1.0, 1.0,	 	0.8, 0.6, 1.0,
	
	1.0,  1.0,  1.0, 1.0,	  0.188, 0, 0.188,
	1.0, -1.0,  1.0, 1.0,	  0.502, 0, 0.502,
	1.0, -1.0, -1.0, 1.0,	  0.8, 0.6, 1.0,

   // +y face
   -1.0,  1.0, -1.0, 1.0,	  0.188, 0, 0.188,	
   -1.0,  1.0,  1.0, 1.0,	  0.502, 0, 0.502,	
	1.0,  1.0,  1.0, 1.0,	  0.8, 0.6, 1.0,	

	1.0,  1.0,  1.0, 1.0,	  0.188, 0, 0.188,	
	1.0,  1.0, -1.0, 1.0,	  0.502, 0, 0.502,
   -1.0,  1.0, -1.0, 1.0,	  0.8, 0.6, 1.0,

   // +z face
   -1.0,  1.0,  1.0, 1.0,	  0.188, 0, 0.188,
   -1.0, -1.0,  1.0, 1.0,	  0.502, 0, 0.502,
	1.0, -1.0,  1.0, 1.0,	  0.8, 0.6, 1.0,

	1.0, -1.0,  1.0, 1.0,	  0.188, 0, 0.188,	
	1.0,  1.0,  1.0, 1.0,	  0.502, 0, 0.502,	
   -1.0,  1.0,  1.0, 1.0,	  0.8, 0.6, 1.0,

   // -x face
   -1.0, -1.0,  1.0, 1.0,	  0.188, 0, 0.188,	
   -1.0,  1.0,  1.0, 1.0,	  0.502, 0, 0.502,
   -1.0,  1.0, -1.0, 1.0,	  0.8, 0.6, 1.0,
   
   -1.0,  1.0, -1.0, 1.0,	  0.188, 0, 0.188,
   -1.0, -1.0, -1.0, 1.0,	  0.502, 0, 0.502,  
   -1.0, -1.0,  1.0, 1.0,	  0.8, 0.6, 1.0,  
   
   // -y face
	1.0, -1.0, -1.0, 1.0,	  0.188, 0, 0.188,
	1.0, -1.0,  1.0, 1.0,	  0.502, 0, 0.502,
   -1.0, -1.0,  1.0, 1.0,	  0.8, 0.6, 1.0,

   -1.0, -1.0,  1.0, 1.0,	  0.188, 0, 0.188,
   -1.0, -1.0, -1.0, 1.0,	  0.502, 0, 0.502,
	1.0, -1.0, -1.0, 1.0,	  0.8, 0.6, 1.0,

	// -z face
	1.0,  1.0, -1.0, 1.0,	  0.188, 0, 0.188,
	1.0, -1.0, -1.0, 1.0,	  0.502, 0, 0.502,
   -1.0, -1.0, -1.0, 1.0,	  0.8, 0.6, 1.0,		

   -1.0, -1.0, -1.0, 1.0,	  0.188, 0, 0.188,	
   -1.0,  1.0, -1.0, 1.0,	  0.502, 0, 0.502,	
	1.0,  1.0, -1.0, 1.0,	  0.8, 0.6, 1.0,
  ]);
  hand_nn = 36; // cube for hand
  diamond_nn = 24; // diamond
  robot_nn = 36; // cube for person
  star_nn = 18; // triangle shape for star
  grid_nn = gndVerts.length;
  sphere_nn = sphVerts.length;
  axis_nn = 6;
  tree_nn = 6;
  tower_nn = 36;
  var nn = 114 + grid_nn + 6 + sphere_nn;

  // Define start points for each shape
  hand_start = 0;
  robot_start = 60;
  star_start = 96;
  diamond_start = 36;
  axis_start = 114;
  tree_start = 120;
  grid_start = 126;
  cylinder_start = grid_start + gndVerts.length/floatsPerVertex + sphVerts.length/floatsPerVertex;
  tower_start = cylinder_start + cylVerts.length/floatsPerVertex;

  console.log("Color shapes len", colorShapes.length);
  console.log(" shapes len", gndVerts.length);

  // colorShapes.push(...gndVerts)
  var colorShapesWithGround = new Float32Array(colorShapes.length + gndVerts.length + sphVerts.length + cylVerts.length + cubeVerts.length);
  colorShapesWithGround.set(colorShapes, 0); 
  colorShapesWithGround.set(gndVerts, colorShapes.length);
  colorShapesWithGround.set(sphVerts, colorShapes.length + gndVerts.length);
  colorShapesWithGround.set(cylVerts, colorShapes.length + gndVerts.length + sphVerts.length);
  colorShapesWithGround.set(cubeVerts, colorShapes.length + gndVerts.length + sphVerts.length + cylVerts.length);
	
  // Create a buffer object
  var shapeBufferHandle = gl.createBuffer();  
  if (!shapeBufferHandle) {
    console.log('Failed to create the shape buffer object');
    return false;
  }

  // Bind the the buffer object to target:
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
  // Transfer data from Javascript array colorShapes to Graphics system VBO
  // (Use sparingly--may be slow if you transfer large shapes stored in files)
  gl.bufferData(gl.ARRAY_BUFFER, colorShapesWithGround, gl.STATIC_DRAW);
//gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);

  var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?
  
  // Connect a VBO Attribute to Shaders------------------------------------------
  //Get GPU's handle for our Vertex Shader's position-input variable: 
  var a_PositionLoc = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_PositionLoc < 0) {
    console.log('Failed to get attribute storage location of a_Position');
    return -1;
  }
  // Use handle to specify how to Vertex Shader retrieves position data from VBO:
  gl.vertexAttribPointer(
  		a_PositionLoc, 	// choose Vertex Shader attribute to fill with data
  		4, 						// how many values? 1,2,3 or 4.  (we're using x,y,z,w)
  		gl.FLOAT, 		// data type for each value: usually gl.FLOAT
  		false, 				// did we supply fixed-point data AND it needs normalizing?
  		FSIZE * 7, 		// Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  		0);						// Offset -- now many bytes from START of buffer to the
  									// value we will actually use?
  gl.enableVertexAttribArray(a_PositionLoc);  
  									// Enable assignment of vertex buffer object's position data
//-----------done.
// Connect a VBO Attribute to Shaders-------------------------------------------
  // Get graphics system's handle for our Vertex Shader's color-input variable;
  var a_ColorLoc = gl.getAttribLocation(gl.program, 'a_Color');
  if(a_ColorLoc < 0) {
    console.log('Failed to get the attribute storage location of a_Color');
    return -1;
  }
  // Use handle to specify how Vertex Shader retrieves color data from our VBO:
  gl.vertexAttribPointer(
  	a_ColorLoc, 				// choose Vertex Shader attribute to fill with data
  	3, 							// how many values? 1,2,3 or 4. (we're using R,G,B)
  	gl.FLOAT, 					// data type for each value: usually gl.FLOAT
  	false, 						// did we supply fixed-point data AND it needs normalizing?
  	FSIZE * 7, 					// Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  	FSIZE * 4);					// Offset -- how many bytes from START of buffer to the
  									// value we will actually use?  Need to skip over x,y,z,w 									
  gl.enableVertexAttribArray(a_ColorLoc);  
  									// Enable assignment of vertex buffer object's position data
//-----------done.
  // UNBIND the buffer object: we have filled the VBO & connected its attributes
  // to our shader, so no more modifications needed.
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return nn;
}

function makeGroundGrid() {
	//==============================================================================
	// Create a list of vertices that create a large grid of lines in the x,y plane
	// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.
	
		var xcount = 100;			// # of lines to draw in x,y to make the grid.
		var ycount = 100;		
		var xymax	= 50.0;			// grid size; extends to cover +/-xymax in x and y.
		 var xColr = new Float32Array([1.0, 1.0, 0.3]);	// bright yellow
		 var yColr = new Float32Array([0.5, 1.0, 0.5]);	// bright green.
		 
		// Create an (global) array to hold this ground-plane's vertices:
		gndVerts = new Float32Array(floatsPerVertex*2*(xcount+ycount));
							// draw a grid made of xcount+ycount lines; 2 vertices per line.
							
		var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
		var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
		
		// First, step thru x values as we make vertical lines of constant-x:
		for(v=0, j=0; v<2*xcount; v++, j+= floatsPerVertex) {
			if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
				gndVerts[j  ] = -xymax + (v  )*xgap;	// x
				gndVerts[j+1] = -xymax;								// y
				gndVerts[j+2] = 0.0;									// z
				gndVerts[j+3] = 1.0;									// w.
			}
			else {				// put odd-numbered vertices at (xnow, +xymax, 0).
				gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
				gndVerts[j+1] = xymax;								// y
				gndVerts[j+2] = 0.0;									// z
				gndVerts[j+3] = 1.0;									// w.
			}
			gndVerts[j+4] = xColr[0];			// red
			gndVerts[j+5] = xColr[1];			// grn
			gndVerts[j+6] = xColr[2];			// blu
		}
		// Second, step thru y values as wqe make horizontal lines of constant-y:
		// (don't re-initialize j--we're adding more vertices to the array)
		for(v=0; v<2*ycount; v++, j+= floatsPerVertex) {
			if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
				gndVerts[j  ] = -xymax;								// x
				gndVerts[j+1] = -xymax + (v  )*ygap;	// y
				gndVerts[j+2] = 0.0;									// z
				gndVerts[j+3] = 1.0;									// w.
			}
			else {					// put odd-numbered vertices at (+xymax, ynow, 0).
				gndVerts[j  ] = xymax;								// x
				gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
				gndVerts[j+2] = 0.0;									// z
				gndVerts[j+3] = 1.0;									// w.
			}
			gndVerts[j+4] = yColr[0];			// red
			gndVerts[j+5] = yColr[1];			// grn
			gndVerts[j+6] = yColr[2];			// blu
		}
	}
function makeSphere() {
//==============================================================================
// Make a sphere from one OpenGL TRIANGLE_STRIP primitive.   
  var slices = 13;		// # of slices of the sphere along the z axis. >=3 req'd
											// (choose odd # or prime# to avoid accidental symmetry)
  var sliceVerts	= 27;	// # of vertices around the top edge of the slice
											// (same number of vertices on bottom of slice, too)
  var topColr = new Float32Array([0.7, 0.7, 0.7]);	// North Pole: light gray
  var equColr = new Float32Array([0.3, 0.7, 0.3]);	// Equator:    bright green
  var botColr = new Float32Array([0.9, 0.9, 0.9]);	// South Pole: brightest gray.
  var sliceAngle = Math.PI/slices;	// lattitude angle spanned by one slice.

	// Create a (global) array to hold this sphere's vertices:
  sphVerts = new Float32Array(  ((slices * 2* sliceVerts) -2) * floatsPerVertex);
	
	var cos0 = 0.0;					// sines,cosines of slice's top, bottom edge.
	var sin0 = 0.0;
	var cos1 = 0.0;
	var sin1 = 0.0;	
	var j = 0;							// initialize our array index
	var isLast = 0;
	var isFirst = 1;
	for(s=0; s<slices; s++) {	// for each slice of the sphere,
		// find sines & cosines for top and bottom of this slice
		if(s==0) {
			isFirst = 1;	// skip 1st vertex of 1st slice.
			cos0 = 1.0; 	// initialize: start at north pole.
			sin0 = 0.0;
		}
		else {					// otherwise, new top edge == old bottom edge
			isFirst = 0;	
			cos0 = cos1;
			sin0 = sin1;
		}								// & compute sine,cosine for new bottom edge.
		cos1 = Math.cos((s+1)*sliceAngle);
		sin1 = Math.sin((s+1)*sliceAngle);
		// go around the entire slice, generating TRIANGLE_STRIP verts
		// (Note we don't initialize j; grows with each new attrib,vertex, and slice)
		if(s==slices-1) isLast=1;	// skip last vertex of last slice.
		for(v=isFirst; v< 2*sliceVerts-isLast; v++, j+=floatsPerVertex) {	
			if(v%2==0)
			{				
				sphVerts[j  ] = sin0 * Math.cos(Math.PI*(v)/sliceVerts); 	
				sphVerts[j+1] = sin0 * Math.sin(Math.PI*(v)/sliceVerts);	
				sphVerts[j+2] = cos0;		
				sphVerts[j+3] = 1.0;			
			}
			else { 
				sphVerts[j  ] = sin1 * Math.cos(Math.PI*(v-1)/sliceVerts);		// x
				sphVerts[j+1] = sin1 * Math.sin(Math.PI*(v-1)/sliceVerts);		// y
				sphVerts[j+2] = cos1;																				// z
				sphVerts[j+3] = 1.0;																				// w.		
			}
			if(s==0) {	// finally, set some interesting colors for vertices:
				sphVerts[j+4]=topColr[0]; 
				sphVerts[j+5]=topColr[1]; 
				sphVerts[j+6]=topColr[2];	
				}
			else if(s==slices-1) {
				sphVerts[j+4]=botColr[0]; 
				sphVerts[j+5]=botColr[1]; 
				sphVerts[j+6]=botColr[2];	
			}
			else {
					sphVerts[j+4]=Math.random();// equColr[0]; 
					sphVerts[j+5]=Math.random();// equColr[1]; 
					sphVerts[j+6]=Math.random();// equColr[2];					
			}
		}
	}
}

function makeCylinder() {
	//==============================================================================
	// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
	// 'stepped spiral' design described in notes.
	// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
	//
	 var ctrColr = new Float32Array([0.2, 0.2, 0.2]);	// dark gray
	 var topColr = new Float32Array([0.4, 0.7, 0.4]);	// light green
	 var botColr = new Float32Array([0.5, 0.5, 1.0]);	// light blue
	 var capVerts = 16;	// # of vertices around the topmost 'cap' of the shape
	 var botRadius = 1.6;		// radius of bottom of cylinder (top always 1.0)
	 
	 // Create a (global) array to hold this cylinder's vertices;
	 cylVerts = new Float32Array(  ((capVerts*6) -2) * floatsPerVertex);
											// # of vertices * # of elements needed to store them. 
	
		// Create circle-shaped top cap of cylinder at z=+1.0, radius 1.0
		// v counts vertices: j counts array elements (vertices * elements per vertex)
		for(v=1,j=0; v<2*capVerts; v++,j+=floatsPerVertex) {	
			// skip the first vertex--not needed.
			if(v%2==0)
			{				// put even# vertices at center of cylinder's top cap:
				cylVerts[j  ] = 0.0; 			// x,y,z,w == 0,0,1,1
				cylVerts[j+1] = 0.0;	
				cylVerts[j+2] = 1.0; 
				cylVerts[j+3] = 1.0;			// r,g,b = topColr[]
				cylVerts[j+4]=ctrColr[0]; 
				cylVerts[j+5]=ctrColr[1]; 
				cylVerts[j+6]=ctrColr[2];
			}
			else { 	// put odd# vertices around the top cap's outer edge;
							// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
							// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
				cylVerts[j  ] = Math.cos(Math.PI*(v-1)/capVerts);			// x
				cylVerts[j+1] = Math.sin(Math.PI*(v-1)/capVerts);			// y
				//	(Why not 2*PI? because 0 < =v < 2*capVerts, so we
				//	 can simplify cos(2*PI * (v-1)/(2*capVerts))
				cylVerts[j+2] = 1.0;	// z
				cylVerts[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts[j+4]=topColr[0]; 
				cylVerts[j+5]=topColr[1]; 
				cylVerts[j+6]=topColr[2];			
			}
		}
		// Create the cylinder side walls, made of 2*capVerts vertices.
		// v counts vertices within the wall; j continues to count array elements
		for(v=0; v< 2*capVerts; v++, j+=floatsPerVertex) {
			if(v%2==0)	// position all even# vertices along top cap:
			{		
					cylVerts[j  ] = Math.cos(Math.PI*(v)/capVerts);		// x
					cylVerts[j+1] = Math.sin(Math.PI*(v)/capVerts);		// y
					cylVerts[j+2] = 1.0;	// z
					cylVerts[j+3] = 1.0;	// w.
					// r,g,b = topColr[]
					cylVerts[j+4]=topColr[0]; 
					cylVerts[j+5]=topColr[1]; 
					cylVerts[j+6]=topColr[2];			
			}
			else		// position all odd# vertices along the bottom cap:
			{
					cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v-1)/capVerts);		// x
					cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v-1)/capVerts);		// y
					cylVerts[j+2] =-1.0;	// z
					cylVerts[j+3] = 1.0;	// w.
					// r,g,b = topColr[]
					cylVerts[j+4]=botColr[0]; 
					cylVerts[j+5]=botColr[1]; 
					cylVerts[j+6]=botColr[2];			
			}
		}
		// Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
		// v counts the vertices in the cap; j continues to count array elements
		for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
			if(v%2==0) {	// position even #'d vertices around bot cap's outer edge
				cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v)/capVerts);		// x
				cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v)/capVerts);		// y
				cylVerts[j+2] =-1.0;	// z
				cylVerts[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts[j+4]=botColr[0]; 
				cylVerts[j+5]=botColr[1]; 
				cylVerts[j+6]=botColr[2];		
			}
			else {				// position odd#'d vertices at center of the bottom cap:
				cylVerts[j  ] = 0.0; 			// x,y,z,w == 0,0,-1,1
				cylVerts[j+1] = 0.0;	
				cylVerts[j+2] =-1.0; 
				cylVerts[j+3] = 1.0;			// r,g,b = botColr[]
				cylVerts[j+4]=botColr[0]; 
				cylVerts[j+5]=botColr[1]; 
				cylVerts[j+6]=botColr[2];
			}
		}
	}


function draw(modelMatrix, u_ModelLoc, hand_angle, diamond_angle, diamond_x, robot_angle, robot_arm, robot_leg, robot_head, tower_angle) {
//==============================================================================
  // Clear <canvas>  colors AND the depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  modelMatrix.setIdentity();

  gl.viewport(0,						// Viewport lower-left corner
  			0, 							// location(in pixels)
  			myCanvas.width/2, 			// viewport width,
  			myCanvas.height);			// viewport height in pixels.

  var vpAspect = (myCanvas.width/2) /		// On-screen aspect ratio for
	  (myCanvas.height);				// this camera: width/height.

  // Add perspective to define a camera lens
  modelMatrix.perspective(35.0,
						  vpAspect,
						  z_near, // z near - 1 
						  z_far); // z far - 1000
 

  aim_x = eye_x + Math.cos(theta);
  aim_y = eye_y + Math.sin(theta);
  aim_z = eye_z + d_tilt;

  modelMatrix.lookAt(eye_x, eye_y, eye_z,
					 aim_x, aim_y, aim_z,
	   				0, 0, 1);

	//--DRAW TOWER--//
	pushMatrix(modelMatrix);

		modelMatrix.translate(3.0, -0.6, 0.35);
		modelMatrix.rotate(90, 0, 0, 1);
		modelMatrix.scale(0.22, 0.22, 0.22);
		// modelMatrix.rotate(90, 1, 0, 0);

		//--Bottom Bottom Link--//
		pushMatrix(modelMatrix);
			//modelMatrix.translate(2.0, 1.5, 0.2);

			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, tower_start, tower_nn);

			pushMatrix(modelMatrix);

				modelMatrix.translate(0.0, 0.0, 1.5);
				modelMatrix.scale(0.6, 0.6, 0.6);

				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLES, tower_start, tower_nn);

				pushMatrix(modelMatrix);

					modelMatrix.translate(0.0, 0.0, 1.5);
					modelMatrix.scale(0.6, 0.6, 0.6);

					gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
					gl.drawArrays(gl.TRIANGLES, tower_start, tower_nn);

				modelMatrix = popMatrix();

			modelMatrix = popMatrix();

		modelMatrix = popMatrix();

	modelMatrix = popMatrix(); 

	//-- DRAW SPHERE --//
	pushMatrix(modelMatrix);
		modelMatrix.translate(-1.0, -0.6, 0.4); // 'set' means DISCARD old matrix,
		modelMatrix.scale(1,1,-1);
		modelMatrix.scale(0.2, 0.2, 0.2);
		modelMatrix.rotate(180, 0, 1, 0);
		//modelMatrix.rotate(currentAngle, 1, 1, 0);  // Spin on XY diagonal axis

		// QUAT
		quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w);	// Quaternion-->Matrix
		modelMatrix.concat(quatMatrix);	

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLE_STRIP, grid_start + gndVerts.length/floatsPerVertex, sphVerts.length/floatsPerVertex);

		// Draw Axis within Sphere
		modelMatrix.scale(1.5, 1.5, 1.5);
		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.LINES, axis_start, axis_nn);	

	modelMatrix  = popMatrix();

	//-- DRAW CYlINDER TOWER --//
	pushMatrix(modelMatrix);

		modelMatrix.translate(0.6,1.5, 1.3); 
		modelMatrix.scale(1,1,-1);				
		modelMatrix.scale(0.075, 0.075, 0.075);

		pushMatrix(modelMatrix);

			modelMatrix.rotate(tower_angle, 1, 0, 1);

			// Bottom cylinder
			pushMatrix(modelMatrix);

				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLE_STRIP, cylinder_start, cylVerts.length/floatsPerVertex);

			modelMatrix = popMatrix();

			// Middle Cylinder
			pushMatrix(modelMatrix);

				modelMatrix.translate(0.0,0.0, 2.0); 
				modelMatrix.rotate(180, 0, 1, 0);

				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLE_STRIP, cylinder_start, cylVerts.length/floatsPerVertex);

			modelMatrix = popMatrix();
			
		modelMatrix = popMatrix();

		pushMatrix(modelMatrix);

			// top Cylinder
			pushMatrix(modelMatrix);

				modelMatrix.translate(0.0,0.0, 4.0);

				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLE_STRIP, cylinder_start, cylVerts.length/floatsPerVertex);

			modelMatrix = popMatrix();

			// top top Cylinder
			pushMatrix(modelMatrix);

				modelMatrix.translate(0.0,0.0, 6.0);
				modelMatrix.rotate(180, 0, 1, 0);

				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLE_STRIP, cylinder_start, cylVerts.length/floatsPerVertex);

			modelMatrix = popMatrix();

		modelMatrix = popMatrix();

	modelMatrix = popMatrix();
  
	//-- DRAW SPINNING DIAMOND --//
	pushMatrix(modelMatrix);

		// draw_diamond(diamond_x);
		modelMatrix.translate(diamond_x, -1.0, 0.8);			
		modelMatrix.scale(0.2, 0.2, 0.2);
		modelMatrix.rotate(diamond_angle, 0, 1, 0);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, diamond_start, diamond_nn);

	modelMatrix = popMatrix(); 

  //-- DRAW HAND --//
  
  pushMatrix(modelMatrix);

  		modelMatrix.translate(-1.4, 1.8, 0.0);
		modelMatrix.rotate(90, 1, 0, 0);
		modelMatrix.translate(0.9, 0.9, 0.0);
		//modelMatrix.setTranslate(0.2, 0.85, 0.0)
		modelMatrix.rotate(hand_rot, 0, 1, 0); // to turn hand to the side

		//-------Draw Palm of the Hand-------//
		// modelMatrix.setTranslate(-0.4,-0.4, 0.0);  // 'set' means DISCARD old matrix,
		modelMatrix.translate(-0.4, -0.4, 0.0)
		// modelMatrix.scale(0.15, 0.15, 0.0375);
		modelMatrix.scale(0.2, 0.2, 0.06);
							
		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

		modelMatrix.translate(0.0, 1.4, 0.0)
		modelMatrix.scale(0.16, 0.5, 1.0);

		// Draw Ring Finger
		pushMatrix(modelMatrix);

			modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);	
			modelMatrix.scale(1.0, 0.7, 1.0)
			modelMatrix.translate(-1.7, -0.15, 0.0)

			// bottom section
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

			// middle section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.8, 1.0)
			modelMatrix.translate(0.0, 2.2, 0.0)

			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

			// top section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.9, 1.0)
			modelMatrix.translate(0.0, 2.0, 0.0)

			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

		modelMatrix = popMatrix();

		// Draw Pinky Finger
		pushMatrix(modelMatrix);

			modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);	
			modelMatrix.scale(1.0, 0.65, 1.0)
			modelMatrix.translate(-5.0, -0.8, 0.0)
			// modelMatrix.scale(1.0, 0.5, 1.0)

			// bottom section
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
			// middle section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.8, 1.0)
			modelMatrix.translate(0.0, 2.2, 0.0)
	
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
			// top section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.6, 1.0)
			modelMatrix.translate(0.0, 2.6, 0.0)
	
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
	
		modelMatrix = popMatrix();

		// Draw Middle Finger
		pushMatrix(modelMatrix);

			modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);	
			modelMatrix.translate(1.7, 0.0, 0.0)
			modelMatrix.scale(1.0, 0.9, 1.0)

			// bottom section
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
			// middle section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.8, 1.0)
			modelMatrix.translate(0.0, 2.2, 0.0)
	
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
			// top section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.9, 1.0)
			modelMatrix.translate(0.0, 2.0, 0.0)
	
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
	
		modelMatrix = popMatrix();

		// Draw Pointer Finger
		pushMatrix(modelMatrix);

			modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);
			modelMatrix.scale(1.0, 0.7, 1.0);
			modelMatrix.translate(5.0, -0.15, 0.0);

			// bottom section
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
			// middle section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.8, 1.0)
			modelMatrix.translate(0.0, 2.2, 0.0)
	
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
			// top section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.9, 1.0)
			modelMatrix.translate(0.0, 2.0, 0.0)
	
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
	
		modelMatrix = popMatrix();

		// Draw Thumb
		pushMatrix(modelMatrix);

			//modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);	
			modelMatrix.translate(7.3, -2.8, 0.0)

			// bottom section
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
			// top section
			modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
			modelMatrix.scale(1.0, 0.8, 1.0)
			modelMatrix.translate(0.0, 2.2, 0.0)
	
			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);
	
	
		modelMatrix = popMatrix();

modelMatrix = popMatrix(); 


//-- DRAW ROBOT --//
pushMatrix(modelMatrix);

		//-- Draw Body --//
		//modelMatrix.setTranslate(-0.4, 0.4, 0.0);
		modelMatrix.rotate(90, 1, 0, 0);
		modelMatrix.translate(-0.5, 0.5, -0.3);
		// modelMatrix.scale(0.15, 0.2, 0.4); 
		modelMatrix.scale(0.15, 0.2, 0.2);

		//modelMatrix.scale(1,1,-1);	
		modelMatrix.rotate(robot_angle, 0, 1, 0); // Cheat the body in a direction !!
		// modelMatrix.rotate(90, 0, 1 ,0 );

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		// gl.drawArrays(gl.TRIANGLES, 60, 36);
		gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);

		modelMatrix.translate(0, -1.0, 0.0)

		// Draw left leg
		pushMatrix(modelMatrix);

				// Draw thigh
				modelMatrix.rotate(robot_leg, 1, 0, 0)
				modelMatrix.translate(-0.4, -0.4, 0.0);
				modelMatrix.scale(0.2, 0.9, 0.3);
				
				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);


		modelMatrix = popMatrix();

		// Draw right leg
		pushMatrix(modelMatrix);

				// Draw thigh
				modelMatrix.rotate(- robot_leg, 1, 0, 0)
				modelMatrix.translate(0.4, -0.4, 0.0);
				modelMatrix.scale(0.2, 0.9, 0.3);
				
				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);

		modelMatrix = popMatrix();

		// Draw left arm
		pushMatrix(modelMatrix);

				// Draw upper arm
				modelMatrix.translate(-1.3, 1.0, 0.0);
				modelMatrix.rotate(- robot_arm, 1, 0, 0);
				modelMatrix.scale(0.2, 0.7, 0.3);
				
				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);

		modelMatrix = popMatrix();

		// Draw right arm
		pushMatrix(modelMatrix);

				// Draw upper arm
				modelMatrix.translate(1.3, 1.0, 0.0);
				modelMatrix.rotate(robot_arm, 1, 0, 0);
				modelMatrix.scale(0.2, 0.7, 0.3);
				
				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);


		modelMatrix = popMatrix();

		// Draw neck and head
		pushMatrix(modelMatrix);

				// Draw neck
				modelMatrix.translate(0.0, 2.0, 0.0);
				modelMatrix.scale(0.2, 0.2, 0.2);
				modelMatrix.rotate(robot_head, 1, 0, 0);

				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);

				// Draw head
				modelMatrix.translate(0.0, 3.0, 0.0);
				modelMatrix.scale(2.5, 2.0, 3.0);
				modelMatrix.rotate(robot_head, 1, 0, 0);

				gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
				gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);


		modelMatrix = popMatrix();

modelMatrix = popMatrix();

//--DRAW STAR--//

pushMatrix(modelMatrix);

	// NEXT, create different drawing axes, and...
	// modelMatrix.setTranslate(0.3, 0.0, 0.0); 
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.translate(0.3, 0.9, -2.0); 
	//g_modelMatrix.scale(1,1,-1);				// convert to left-handed coord sys
	modelMatrix.scale(0.1, 0.1, 0.1);	
	//modelMatrix.rotate(90, 0, 1, 0);

	// var dist = Math.sqrt(xMdragTot*xMdragTot + yMdragTot*yMdragTot);
	// modelMatrix.rotate(dist*120.0, -g_yMdragTot+0.0001, g_xMdragTot+0.0001, 0.0);

	pushMatrix(modelMatrix);

	// Mouse-Dragging for Rotation:
		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, star_start, star_nn);

	modelMatrix = popMatrix();

	pushMatrix(modelMatrix);

		modelMatrix.rotate(70, 1, 0 ,0);
		modelMatrix.translate(0.0, 0.9, 1.3);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, star_start, star_nn);

		// New triangle

		modelMatrix.rotate(72, 1, 0 ,0);
		modelMatrix.translate(0.0, 0.9, 1.3);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, star_start, star_nn);

		// New triangle

		modelMatrix.rotate(72, 1, 0 ,0);
		modelMatrix.translate(0.0, 0.9, 1.3);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, star_start, star_nn);

		// New triangles

		modelMatrix.rotate(72, 1, 0 ,0);
		modelMatrix.translate(0.0, 0.9, 1.3);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, star_start, star_nn);


	modelMatrix = popMatrix();

modelMatrix = popMatrix();

//-- DRAW AXIS --//
pushMatrix(modelMatrix);
	modelMatrix.translate(0.2, 0.4, 0.6); 
	modelMatrix.scale(-1,1,1);
	modelMatrix.scale(0.3, 0.3, 0.3);	
	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.LINES, axis_start, axis_nn);	
modelMatrix = popMatrix();

//-- DRAW GROUND PLANE --//

pushMatrix(modelMatrix);  // SAVE world drawing coords.
	//---------Draw Ground Plane, without spinning.
	// position it.
	modelMatrix.translate( 0.4, -0.4, 0.0);	
	modelMatrix.scale(0.1, 0.1, 0.1);				// shrink by 10X:

	// Drawing:
	// Pass our current matrix to the vertex shaders:
	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	// Draw just the ground-plane's vertices
	gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
						//gndStart/floatsPerVertex,	// start at this vertex number, and
						grid_start,
						gndVerts.length/floatsPerVertex);	// draw this many vertices.
modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

//-------------------------------------------------------------------------
//----------------------Create, fill RIGHT viewport------------------------
//-------------------------------------------------------------------------

gl.viewport(myCanvas.width/2,			// Viewport lower-left corner
			0, 							// location(in pixels)
  			myCanvas.width/2, 			// viewport width,
  			myCanvas.height);			// viewport height in pixels.

vpAspect = (myCanvas.width/2) /				// On-screen aspect ratio for
				(myCanvas.height);	// this camera: width/height.

// Ortho view
// Matrix4.ortho(left,right,bottom,top,near,far)
// modelMatrix.ortho(-1,1,-1,1,-1,1)
// -z = (far-near)/3
// z_near = 1;
// z_far = 20;
var z = (z_far - z_near)/3;
modelMatrix.setOrtho(-1 * z, // left
	 				 z,      // right
				    -1 * z,   // bottom
					z,       // top
				   z_near,  // near
				   z_far,    // far
);

modelMatrix.lookAt(	eye_x, eye_y, eye_z, 				// 'Center' or 'Eye Point',
  					aim_x, aim_y, aim_z, 				// look-At point,
  					0, 0, 1);	

//--DRAW TOWER--//
pushMatrix(modelMatrix);

modelMatrix.translate(3.0, -0.6, 0.35);
modelMatrix.rotate(90, 0, 0, 1);
modelMatrix.scale(0.22, 0.22, 0.22);
// modelMatrix.rotate(90, 1, 0, 0);

//--Bottom Bottom Link--//
pushMatrix(modelMatrix);
	//modelMatrix.translate(2.0, 1.5, 0.2);

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, tower_start, tower_nn);

	pushMatrix(modelMatrix);

		modelMatrix.translate(0.0, 0.0, 1.5);
		modelMatrix.scale(0.6, 0.6, 0.6);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, tower_start, tower_nn);

		pushMatrix(modelMatrix);

			modelMatrix.translate(0.0, 0.0, 1.5);
			modelMatrix.scale(0.6, 0.6, 0.6);

			gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
			gl.drawArrays(gl.TRIANGLES, tower_start, tower_nn);

		modelMatrix = popMatrix();

	modelMatrix = popMatrix();

modelMatrix = popMatrix();

modelMatrix = popMatrix(); 

//-- DRAW SPHERE --//
pushMatrix(modelMatrix);
modelMatrix.translate(-1.0, -0.6, 0.4); // 'set' means DISCARD old matrix,
modelMatrix.scale(1,1,-1);
modelMatrix.scale(0.2, 0.2, 0.2);
modelMatrix.rotate(180, 0, 1, 0);
//modelMatrix.rotate(currentAngle, 1, 1, 0);  // Spin on XY diagonal axis

// QUAT
quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w);	// Quaternion-->Matrix
modelMatrix.concat(quatMatrix);	

gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.TRIANGLE_STRIP, grid_start + gndVerts.length/floatsPerVertex, sphVerts.length/floatsPerVertex);

// Draw Axis within Sphere
modelMatrix.scale(1.5, 1.5, 1.5);
gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.LINES, axis_start, axis_nn);	

modelMatrix  = popMatrix();

//-- DRAW CYlINDER TOWER --//
pushMatrix(modelMatrix);

modelMatrix.translate(0.6,1.5, 1.3); 
modelMatrix.scale(1,1,-1);				
modelMatrix.scale(0.075, 0.075, 0.075);

pushMatrix(modelMatrix);

	modelMatrix.rotate(tower_angle, 1, 0, 1);

	// Bottom cylinder
	pushMatrix(modelMatrix);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLE_STRIP, cylinder_start, cylVerts.length/floatsPerVertex);

	modelMatrix = popMatrix();

	// Middle Cylinder
	pushMatrix(modelMatrix);

		modelMatrix.translate(0.0,0.0, 2.0); 
		modelMatrix.rotate(180, 0, 1, 0);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLE_STRIP, cylinder_start, cylVerts.length/floatsPerVertex);

	modelMatrix = popMatrix();
	
modelMatrix = popMatrix();

pushMatrix(modelMatrix);

	// top Cylinder
	pushMatrix(modelMatrix);

		modelMatrix.translate(0.0,0.0, 4.0);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLE_STRIP, cylinder_start, cylVerts.length/floatsPerVertex);

	modelMatrix = popMatrix();

	// top top Cylinder
	pushMatrix(modelMatrix);

		modelMatrix.translate(0.0,0.0, 6.0);
		modelMatrix.rotate(180, 0, 1, 0);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLE_STRIP, cylinder_start, cylVerts.length/floatsPerVertex);

	modelMatrix = popMatrix();

modelMatrix = popMatrix();

modelMatrix = popMatrix();

//-- DRAW SPINNING DIAMOND --//
pushMatrix(modelMatrix);

// draw_diamond(diamond_x);
modelMatrix.translate(diamond_x, -1.0, 0.8);			
modelMatrix.scale(0.2, 0.2, 0.2);
modelMatrix.rotate(diamond_angle, 0, 1, 0);

gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.TRIANGLES, diamond_start, diamond_nn);

modelMatrix = popMatrix(); 

//-- DRAW HAND --//

pushMatrix(modelMatrix);

  modelMatrix.translate(-1.4, 1.8, 0.0);
modelMatrix.rotate(90, 1, 0, 0);
modelMatrix.translate(0.9, 0.9, 0.0);
//modelMatrix.setTranslate(0.2, 0.85, 0.0)
modelMatrix.rotate(hand_rot, 0, 1, 0); // to turn hand to the side

//-------Draw Palm of the Hand-------//
// modelMatrix.setTranslate(-0.4,-0.4, 0.0);  // 'set' means DISCARD old matrix,
modelMatrix.translate(-0.4, -0.4, 0.0)
// modelMatrix.scale(0.15, 0.15, 0.0375);
modelMatrix.scale(0.2, 0.2, 0.06);
					
gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

modelMatrix.translate(0.0, 1.4, 0.0)
modelMatrix.scale(0.16, 0.5, 1.0);

// Draw Ring Finger
pushMatrix(modelMatrix);

	modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);	
	modelMatrix.scale(1.0, 0.7, 1.0)
	modelMatrix.translate(-1.7, -0.15, 0.0)

	// bottom section
	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// middle section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.8, 1.0)
	modelMatrix.translate(0.0, 2.2, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// top section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.9, 1.0)
	modelMatrix.translate(0.0, 2.0, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

modelMatrix = popMatrix();

// Draw Pinky Finger
pushMatrix(modelMatrix);

	modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);	
	modelMatrix.scale(1.0, 0.65, 1.0)
	modelMatrix.translate(-5.0, -0.8, 0.0)
	// modelMatrix.scale(1.0, 0.5, 1.0)

	// bottom section
	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// middle section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.8, 1.0)
	modelMatrix.translate(0.0, 2.2, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// top section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.6, 1.0)
	modelMatrix.translate(0.0, 2.6, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);


modelMatrix = popMatrix();

// Draw Middle Finger
pushMatrix(modelMatrix);

	modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);	
	modelMatrix.translate(1.7, 0.0, 0.0)
	modelMatrix.scale(1.0, 0.9, 1.0)

	// bottom section
	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// middle section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.8, 1.0)
	modelMatrix.translate(0.0, 2.2, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// top section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.9, 1.0)
	modelMatrix.translate(0.0, 2.0, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);


modelMatrix = popMatrix();

// Draw Pointer Finger
pushMatrix(modelMatrix);

	modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);
	modelMatrix.scale(1.0, 0.7, 1.0);
	modelMatrix.translate(5.0, -0.15, 0.0);

	// bottom section
	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// middle section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.8, 1.0)
	modelMatrix.translate(0.0, 2.2, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// top section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.9, 1.0)
	modelMatrix.translate(0.0, 2.0, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);


modelMatrix = popMatrix();

// Draw Thumb
pushMatrix(modelMatrix);

	//modelMatrix.rotate(finger_angle, 1.0, 0, 0.0);	
	modelMatrix.translate(7.3, -2.8, 0.0)

	// bottom section
	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);

	// top section
	modelMatrix.rotate(hand_angle, 1.0, 0, 0.0)
	modelMatrix.scale(1.0, 0.8, 1.0)
	modelMatrix.translate(0.0, 2.2, 0.0)

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, hand_start, hand_nn);


modelMatrix = popMatrix();

modelMatrix = popMatrix(); 


//-- DRAW ROBOT --//
pushMatrix(modelMatrix);

//-- Draw Body --//
//modelMatrix.setTranslate(-0.4, 0.4, 0.0);
modelMatrix.rotate(90, 1, 0, 0);
modelMatrix.translate(-0.5, 0.5, -0.3);
// modelMatrix.scale(0.15, 0.2, 0.4); 
modelMatrix.scale(0.15, 0.2, 0.2);

//modelMatrix.scale(1,1,-1);	
modelMatrix.rotate(robot_angle, 0, 1, 0); // Cheat the body in a direction !!
// modelMatrix.rotate(90, 0, 1 ,0 );

gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
// gl.drawArrays(gl.TRIANGLES, 60, 36);
gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);

modelMatrix.translate(0, -1.0, 0.0)

// Draw left leg
pushMatrix(modelMatrix);

		// Draw thigh
		modelMatrix.rotate(robot_leg, 1, 0, 0)
		modelMatrix.translate(-0.4, -0.4, 0.0);
		modelMatrix.scale(0.2, 0.9, 0.3);
		
		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);


modelMatrix = popMatrix();

// Draw right leg
pushMatrix(modelMatrix);

		// Draw thigh
		modelMatrix.rotate(- robot_leg, 1, 0, 0)
		modelMatrix.translate(0.4, -0.4, 0.0);
		modelMatrix.scale(0.2, 0.9, 0.3);
		
		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);

modelMatrix = popMatrix();

// Draw left arm
pushMatrix(modelMatrix);

		// Draw upper arm
		modelMatrix.translate(-1.3, 1.0, 0.0);
		modelMatrix.rotate(- robot_arm, 1, 0, 0);
		modelMatrix.scale(0.2, 0.7, 0.3);
		
		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);

modelMatrix = popMatrix();

// Draw right arm
pushMatrix(modelMatrix);

		// Draw upper arm
		modelMatrix.translate(1.3, 1.0, 0.0);
		modelMatrix.rotate(robot_arm, 1, 0, 0);
		modelMatrix.scale(0.2, 0.7, 0.3);
		
		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);


modelMatrix = popMatrix();

// Draw neck and head
pushMatrix(modelMatrix);

		// Draw neck
		modelMatrix.translate(0.0, 2.0, 0.0);
		modelMatrix.scale(0.2, 0.2, 0.2);
		modelMatrix.rotate(robot_head, 1, 0, 0);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);

		// Draw head
		modelMatrix.translate(0.0, 3.0, 0.0);
		modelMatrix.scale(2.5, 2.0, 3.0);
		modelMatrix.rotate(robot_head, 1, 0, 0);

		gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
		gl.drawArrays(gl.TRIANGLES, robot_start, robot_nn);


modelMatrix = popMatrix();

modelMatrix = popMatrix();

//--DRAW STAR--//

pushMatrix(modelMatrix);

// NEXT, create different drawing axes, and...
// modelMatrix.setTranslate(0.3, 0.0, 0.0); 
modelMatrix.rotate(90, 1, 0, 0);
modelMatrix.translate(0.3, 0.9, -2.0); 
//g_modelMatrix.scale(1,1,-1);				// convert to left-handed coord sys
modelMatrix.scale(0.1, 0.1, 0.1);	
//modelMatrix.rotate(90, 0, 1, 0);

// var dist = Math.sqrt(xMdragTot*xMdragTot + yMdragTot*yMdragTot);
// modelMatrix.rotate(dist*120.0, -g_yMdragTot+0.0001, g_xMdragTot+0.0001, 0.0);

pushMatrix(modelMatrix);

// Mouse-Dragging for Rotation:
gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.TRIANGLES, star_start, star_nn);

modelMatrix = popMatrix();

pushMatrix(modelMatrix);

modelMatrix.rotate(70, 1, 0 ,0);
modelMatrix.translate(0.0, 0.9, 1.3);

gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.TRIANGLES, star_start, star_nn);

// New triangle

modelMatrix.rotate(72, 1, 0 ,0);
modelMatrix.translate(0.0, 0.9, 1.3);

gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.TRIANGLES, star_start, star_nn);

// New triangle

modelMatrix.rotate(72, 1, 0 ,0);
modelMatrix.translate(0.0, 0.9, 1.3);

gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.TRIANGLES, star_start, star_nn);

// New triangles

modelMatrix.rotate(72, 1, 0 ,0);
modelMatrix.translate(0.0, 0.9, 1.3);

gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.TRIANGLES, star_start, star_nn);


modelMatrix = popMatrix();

modelMatrix = popMatrix();

//-- DRAW AXIS --//
pushMatrix(modelMatrix);
modelMatrix.translate(0.2, 0.4, 0.6); 
modelMatrix.scale(-1,1,1);
modelMatrix.scale(0.3, 0.3, 0.3);	
gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
gl.drawArrays(gl.LINES, axis_start, axis_nn);	
modelMatrix = popMatrix();

//-- DRAW GROUND PLANE --//

pushMatrix(modelMatrix);  // SAVE world drawing coords.
//---------Draw Ground Plane, without spinning.
// position it.
modelMatrix.translate( 0.4, -0.4, 0.0);	
modelMatrix.scale(0.1, 0.1, 0.1);				// shrink by 10X:

// Drawing:
// Pass our current matrix to the vertex shaders:
gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
// Draw just the ground-plane's vertices
gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
				//gndStart/floatsPerVertex,	// start at this vertex number, and
				grid_start,
				gndVerts.length/floatsPerVertex);	// draw this many vertices.
modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.


}

function draw_diamond(diamond_x){
	//pushMatrix(modelMatrix);

	//modelMatrix.setTranslate(diamond_x, -0.70, 0.0);
	modelMatrix.translate(diamond_x, -0.70, 0.5);			
	modelMatrix.scale(0.2, 0.2, 0.2);
	modelMatrix.rotate(diamond_angle, 0, 1, 0);

	gl.uniformMatrix4fv(u_ModelLoc, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, diamond_start, diamond_nn);

	//modelMatrix = popMatrix(); 
}

// Last time that this function was called:  (used for animation timing)
var g_last = Date.now();

function animate_hand(handCurrX, handDir, diamondAngle, diamondCurrX, diamondDir, robot_angle, robot_arm, robot_leg, robot_direction_leg, robot_direction_arm, robot_head, robot_head_dir, tower_angle, tower_dir) {
//==============================================================================
	// Calculate the elapsed time
	var now = Date.now();
	var elapsed = now - g_last;
	g_last = now;

	//-- HAND ANIMATIONS --//

	// if dir = 1, we are moving down
	if (handDir == 1.0){
		// check if we are out of range
		if (handCurrX > 80){
			// switch directions
			handDir = 0.0;
			handCurrX = handCurrX - 1;
		}
		else{
			handCurrX = handCurrX + 1;
			finger_angle = finger_angle + 0.5;
			// if (finger_angle < 30){
			// 	finger_angle = finger_angle + 1;
			// };
		};
	} else if (handDir == 0.0){
		// check if we are out of range
		if (handCurrX <= 0){
			// switch directions
			handDir = 1.0;
			handCurrX = handCurrX + 1;
		} else{
			handCurrX = handCurrX - 1;
			finger_angle = finger_angle - 0.5;
			// if (finger_angle < -30){
			// 	finger_angle = finger_angle - 1;
			// };
		};
	};
	
	//-- DIAMOND ANIMATION --//

	// if dir = 1, we are moving right
	  if (diamondDir == 1.0){
		// check if we are out of range
		if (diamondCurrX > 0.85){
			// switch directions
			diamondDir = 0.0;
			diamondCurrX = diamondCurrX - 0.01;
		}
		else{
			diamondCurrX = diamondCurrX + 0.01;
		};
	  } else if (diamondDir == 0.0){
		// check if we are out of range
		if (diamondCurrX < -0.85){
			// switch directions
			diamondDir = 1.0;
			diamondCurrX = diamondCurrX + 0.01;
		} else{
			diamondCurrX = diamondCurrX - 0.01;
		};
	  };
	  
	  var newAngleDiamond = diamondAngle + (ANGLE_STEP_DIAMOND * elapsed) / 1000.0;

	  //-- ROBOT ANIMATIONS --//
	  var newAngleRobot = robot_angle + (ANGLE_STEP_ROBOT * elapsed) / 1000.0;

	 if (legBrake > 0.5){ // if running
		 	  // robot arm and legs 
			   if (robot_direction_leg == 1.0){
				// check if we are out of range
				if (robot_leg > 60){
					// switch directions
					robot_direction_leg = 0.0;
					robot_leg = robot_leg - 1;
				} else{
					robot_leg = robot_leg + 1;
				};
				
			  } else if (robot_direction_leg == 0.0){
				// check if we are out of range
				if (robot_leg < -60){
					// switch directions
					robot_direction_leg = 1.0;
					robot_leg = robot_leg + 1;
		
				} else{
					robot_leg = robot_leg - 1;
				};
		
			  };
	 };

	 if (armBrake > 0.5){ // if running
		// robot arm and legs 
		if (robot_direction_arm == 1.0){
		 // check if we are out of range
		 if (robot_arm > 60){
			 // switch directions
			 robot_direction_arm = 0.0;
			 robot_arm = robot_arm - 1;
		 } else{
			 robot_arm = robot_arm + 1;
		 };
		 
	   } else if (robot_direction_arm == 0.0){
		 // check if we are out of range
		 if (robot_arm < -60){
			 // switch directions
			 robot_direction_arm = 1.0;
			 robot_arm = robot_arm + 1;
 
		 } else{
			 robot_arm = robot_arm - 1;
		 };
 
	   };
    };

	if (headBrake > 0.5){

	  // robot head nodding
	  if (robot_head_dir == 1.0){
		// check if we are out of range
		if (robot_head > 20){
			// switch directions
			robot_head_dir = 0.0;
			robot_head = robot_head - 0.2;
		} else{
			robot_head = robot_head + 0.2;
		};
		
	  } else if (robot_head_dir == 0.0){
		// check if we are out of range
		if (robot_head < -20){
			// switch directions
			robot_head_dir = 1.0;
			robot_head = robot_head + 0.2;

		} else{
			robot_head = robot_head - 0.2;
		};

	  };

	}

	//-- TOWER ANIMATION --//
	// if dir = 1, we are moving right
	// if dir = 1, we are moving down
	if (tower_dir == 1.0){
		// check if we are out of range
		if (tower_angle > 30){
			// switch directions
			tower_dir = 0.0;
			tower_angle = tower_angle - 1;
		}
		else{
			tower_angle = tower_angle + 1;
		};
	} else if (tower_dir == 0.0){
		// check if we are out of range
		if (tower_angle <= -30){
			// switch directions
			tower_dir = 1.0;
			tower_angle = tower_angle + 1;
		} else{
			tower_angle = tower_angle- 1;
		};
	};

    
  	return [handCurrX, handDir, newAngleDiamond %= 360, diamondCurrX, diamondDir, newAngleRobot %= 360, robot_arm, robot_leg, robot_direction_leg, robot_direction_arm, robot_head, robot_head_dir, tower_angle, tower_dir];
}

//==================HTML Button Callbacks==================\\
function rotateHand() {
	hand_rot += 10;
  }

function spinUpDiamond() {
  ANGLE_STEP_DIAMOND += 25; 
}

function spinUpRobot() {
	ANGLE_STEP_ROBOT += 25; 
  }

function spinDownDiamond() {
 ANGLE_STEP_DIAMOND -= 25; 
}

function spinDownRobot() {
	ANGLE_STEP_ROBOT -= 25; 
   }

function runStopDiamond() {
  if(ANGLE_STEP_DIAMOND*ANGLE_STEP_DIAMOND > 1) {
    myTmp = ANGLE_STEP_DIAMOND;
    ANGLE_STEP_DIAMOND = 0;
  }
  else {
  	ANGLE_STEP_DIAMOND = myTmp;
  }
}

function runStopRobot() {
	if(ANGLE_STEP_ROBOT*ANGLE_STEP_ROBOT > 1) {
	  myTmp = ANGLE_STEP_ROBOT;
	  ANGLE_STEP_ROBOT = 0;
	}
	else {
		ANGLE_STEP_ROBOT = myTmp;
	}
  }

function resetSphere() {
	// Called when user presses 'Clear' button in our webpage
	// g_xMdragTot = 0.0;
	// g_yMdragTot = 0.0;
	var res=5;
	qTot.clear();
}

function leg_stop() {
	//==============================================================================
	  if(legBrake > 0.5)	// if running,
	  {
		legBrake = 0.0;	// stop, and change button label:
		  // document.getElementById("A0button").value="Angle 0 OFF";
		}
	  else 
	  {
		legBrake = 1.0;	// Otherwise, go.
		// robot_direction = 1.0;
		  // document.getElementById("A0button").value="Angle 0 ON-";
		}
	}
	
function arm_stop() {
	//==============================================================================
	  if(armBrake > 0.5)	// if running,
	  {
		  armBrake = 0.0;	// stop, and change button label:
		 // document.getElementById("A1button").value="Angle 1 OFF";
		}
	  else 
	  {
		armBrake = 1.0;	// Otherwise, go.
		  // document.getElementById("A1button").value="Angle 1 ON-";
		}
	}
	
function head_stop() {
	//==============================================================================
	  if(headBrake > 0.5)	// if running,
	  {
		  headBrake = 0.0;	// stop, and change button label:
		  // document.getElementById("A2button").value="Angle 2 OFF";
		}
	  else 
	  {
		  headBrake = 1.0;	// Otherwise, go.
		  // document.getElementById("A2button").value="Angle 2 ON-";
		}
	}

function myKeyDown(kev) {
		//===============================================================================
		// Called when user presses down ANY key on the keyboard;
		//
		// For a light, easy explanation of keyboard events in JavaScript,
		// see:    http://www.kirupa.com/html5/keyboard_events_in_javascript.htm
		// For a thorough explanation of a mess of JavaScript keyboard event handling,
		// see:    http://javascript.info/tutorial/keyboard-events
		//
		// NOTE: Mozilla deprecated the 'keypress' event entirely, and in the
		//        'keydown' event deprecated several read-only properties I used
		//        previously, including kev.charCode, kev.keyCode. 
		//        Revised 2/2019:  use kev.key and kev.code instead.
		//
		// Report EVERYTHING in console:
		  console.log(  "--kev.code:",    kev.code,   "\t\t--kev.key:",     kev.key, 
					  "\n--kev.ctrlKey:", kev.ctrlKey,  "\t--kev.shiftKey:",kev.shiftKey,
					  "\n--kev.altKey:",  kev.altKey,   "\t--kev.metaKey:", kev.metaKey);
		
		 
			switch(kev.code) {
				//----------------Arrow keys------------------------
				case "ArrowLeft": 	
					console.log(' left-arrow.');
					look_left()
					break;
				case "ArrowRight":
					console.log('right-arrow.');
					look_right();
				  break;
				case "ArrowUp":
					console.log("arrow-up");
					look_up();
					break;
				case "ArrowDown":
					console.log("arrow-down")
					look_down();
					break;
				case "KeyW":
					console.log("key W")
					move_forward();
					break;
				case "KeyD":
					console.log("key D")
					move_right();
					break;
				case "KeyS":
					console.log("key S")
					move_backward();
					break;
				case "KeyA":
					console.log("key A")
					move_left();
					break;
				

			default:
			  console.log("UNUSED!");
			  break;
			}
			kev.preventDefault();
}

function look_right(){
	console.log("looking right");
	theta -= 0.01;
	// d_tilt -= 0.01;
}

function look_left(){
	console.log("looking left");
	theta += 0.01;
	// d_tilt += 0.01;
}

function look_down(){
	console.log("looking down");
	d_tilt -= 0.01;
}

function look_up(){
	console.log("looking up");
	d_tilt += 0.01;
}

function move_left(){
	// adjust where the eye goes
	console.log("moving left");

	b1 = 0;
	b2 = 0;
	b3 = 1;
	new_aim_x = eye_x - aim_x;
	new_aim_y = eye_y - aim_y;
	new_aim_z = eye_z - aim_z;
	cross = [ new_aim_y * b3 - new_aim_z * b2, new_aim_z * b1 - new_aim_x * b3, new_aim_x * b2 - new_aim_y * b1 ]

	eye_x += cross[0] * 0.1;
	eye_y += cross[1] * 0.1;
	eye_z += cross[2] * 0.1;
}

function move_right(){
	console.log("moving right");

	b1 = 0;
	b2 = 0;
	b3 = 1;
	new_aim_x = eye_x - aim_x;
	new_aim_y = eye_y - aim_y;
	new_aim_z = eye_z - aim_z;
	cross = [ new_aim_y * b3 - new_aim_z * b2, new_aim_z * b1 - new_aim_x * b3, new_aim_x * b2 - new_aim_y * b1 ]

	eye_x -= cross[0] * 0.1;
	eye_y -= cross[1] * 0.1;
	eye_z -= cross[2] * 0.1;
}

function move_forward(){
	console.log("moving forward");
	eye_x += Math.cos(theta) * 0.15;
	eye_y += Math.sin(theta) * 0.15;
	eye_z += d_tilt * 0.15;
 }

function move_backward(){
	console.log("moving backwards");
	eye_x -= Math.cos(theta) * 0.15;
	eye_y -= Math.sin(theta) * 0.15;
	eye_z -= d_tilt * 0.15;
}
	
function myKeyUp(kev) {
	//===============================================================================
	// Called when user releases ANY key on the keyboard; captures scancodes well
	
		console.log('myKeyUp()--keyCode='+kev.keyCode+' released.');
	}
 
function myMouseDown(ev) {
	//==============================================================================
	// Called when user PRESSES down any mouse button;
	// 									(Which button?    console.log('ev.button='+ev.button);   )
	// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
	//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
	var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
	var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = myCanvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
	//  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);

	// Convert to Canonical View Volume (CVV) coordinates too:
	var x = (xp - myCanvas.width/2)  / 		// move origin to center of canvas and
							(myCanvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - myCanvas.height/2) /		//										 -1 <= y < +1.
							(myCanvas.height/2);
	//	console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);
	
	isDrag = true;											// set our mouse-dragging flag
	xMclik = x;													// record where mouse-dragging began
	yMclik = y;
};
		
		
function myMouseMove(ev) {
	//==============================================================================
	// Called when user MOVES the mouse with a button already pressed down.
	// 									(Which button?   console.log('ev.button='+ev.button);    )
	// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
	//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	if(isDrag==false) return;				// IGNORE all mouse-moves except 'dragging'

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
	var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
	var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = myCanvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
	//  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);

	// Convert to Canonical View Volume (CVV) coordinates too:
	var x = (xp - myCanvas.width/2)  / 		// move origin to center of canvas and
						(myCanvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - myCanvas.height/2) /		//										 -1 <= y < +1.
							(myCanvas.height/2);

	// find how far we dragged the mouse:
	xMdragTot += (x - xMclik);					// Accumulate change-in-mouse-position,&
	yMdragTot += (y - yMclik);
	// AND use any mouse-dragging we found to update quaternions qNew and qTot.
	dragQuat(x - xMclik, y - yMclik);

	xMclik = x;													// Make NEXT drag-measurement from here.
	yMclik = y;
};

function dragQuat(xdrag, ydrag) {
	//==============================================================================
	// Called when user drags mouse by 'xdrag,ydrag' as measured in CVV coords.
	// We find a rotation axis perpendicular to the drag direction, and convert the 
	// drag distance to an angular rotation amount, and use both to set the value of 
	// the quaternion qNew.  We then combine this new rotation with the current 
	// rotation stored in quaternion 'qTot' by quaternion multiply.  Note the 
	// 'draw()' function converts this current 'qTot' quaternion to a rotation 
	// matrix for drawing. 
	var res = 5;
	var qTmp = new Quaternion(0,0,0,1);

	var dist = Math.sqrt(xdrag*xdrag + ydrag*ydrag);
	//var dist = Math.sqrt(Math.cos(theta + 90) + Math.sin(theta +90));
	// (-sin(theta), cos(theta), 0)
	//var dist = Math.sin(theta) + Math.cos(theta);
	//console.log('xdrag,ydrag=',xdrag.toFixed(5),ydrag.toFixed(5),'dist=',dist.toFixed(5));

	// find vector perpendicular to direction vector
	var new_x = -Math.sin(theta + 90);
    var new_y = Math.cos(theta + 90);
	//qNew.setFromAxisAngle(-new_y + 0.0001, new_x + 0.0001, 0.0, dist*150.0);
	qNew.setFromAxisAngle(-ydrag * new_y + 0.0001, xdrag * new_x + 0.0001, 0.0, dist*150.0);
							
	qTmp.multiply(qNew,qTot);	// apply new rotation to current rotation. 

	qTot.copy(qTmp);

};
	
		
function myMouseUp(ev) {
	//==============================================================================
	// Called when user RELEASES mouse button pressed previously.
	// 									(Which button?   console.log('ev.button='+ev.button);    )
	// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
	//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
	var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
	var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = myCanvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
	//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);

	// Convert to Canonical View Volume (CVV) coordinates too:
	var x = (xp - myCanvas.width/2)  / 		// move origin to center of canvas and
							(myCanvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - myCanvas.height/2) /		//										 -1 <= y < +1.
							(myCanvas.height/2);
	//	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);
	
	isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:
	xMdragTot += (x - xMclik);
	yMdragTot += (y - yMclik);
	//	console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);

	// AND use any mouse-dragging we found to update quaternions qNew and qTot;
	dragQuat(x - xMclik, y - yMclik);

};
		
function myMouseClick(ev) {
	//=============================================================================
	// Called when user completes a mouse-button single-click event 
	// (e.g. mouse-button pressed down, then released)
	// 									   
		console.log("myMouseClick() on button: ", ev.button); 
}	
		
function myMouseDblClick(ev) {
	//=============================================================================
	// Called when user completes a mouse-button double-click event 
	// 									   
		console.log("myMouse-DOUBLE-Click() on button: ", ev.button); 
}

function drawResize() {
	//==============================================================================
	// Called when user re-sizes their browser window , because our HTML file
	// contains:  <body onload="main()" onresize="winResize()">
			
	//Report our current browser-window contents:
			
	console.log('g_Canvas width,height=', myCanvas.width, myCanvas.height);		
	console.log('Browser window: innerWidth,innerHeight=', 
														innerWidth, innerHeight);	
														// http://www.w3schools.com/jsref/obj_window.asp
			
				
	//Make canvas fill the top 2/3 of our browser window:
	var xtraMargin = 16; 
	myCanvas.width = innerWidth - xtraMargin;
	myCanvas.height = (innerHeight*2/3) - xtraMargin;
	// IMPORTANT!  Need a fresh drawing in the re-sized viewports.
	//draw();				// draw in all viewports.
	draw(modelMatrix, u_ModelLoc, hand_angle, diamond_angle, diamond_x, robot_angle, robot_arm, robot_leg, robot_head); 
}