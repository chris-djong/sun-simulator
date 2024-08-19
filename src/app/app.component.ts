import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonEngine } from '@angular/ssr';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  DirectionalLight,
  MeshStandardMaterial,
  BoxGeometry,
} from 'three';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { TransformControls } from 'three/addons/controls/TransformControls.js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private renderer!: WebGLRenderer;
  private transformControls!: TransformControls;
  public selectedObject: THREE.Object3D | null = null;
  private orbitControls!: OrbitControls;
  private isCreateFreeForm: boolean = false;

  private hoverPoint!: THREE.Mesh;

  public position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  public dimensions: { width: number; height: number; depth: number } = {
    width: 1,
    height: 1,
    depth: 1,
  };

  private rendererWidth = 10;
  private rendererHeight = 10;

  private gridSize: number = 100;
  private gridDivision: number = 50;

  private gridHelper!: THREE.GridHelper;

  private freeformPoints: THREE.Vector2[] = [];
  private freeformLine: THREE.Mesh | null = null;

  constructor() {}

  ngOnInit(): void {
    this.rendererWidth = window.innerWidth - 350;
    this.rendererHeight = window.innerHeight;
  }
  private onFreeformClick(event: MouseEvent) {
    const brect = this.renderer.domElement.getBoundingClientRect();

    const mouse = new THREE.Vector2(
      ((event.clientX - brect.left) / this.rendererWidth) * 2 - 1,
      ((event.clientY - brect.top) / this.rendererHeight) * -2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObject(this.gridHelper, true);
    if (intersects.length > 0) {
      const point = new THREE.Vector3().copy(intersects[0].point);
      // - z because we rotate around X axis later
      const point2D = new THREE.Vector2(point.x, -point.z);
      // If it's the first point, start the freeform line
      if (this.freeformPoints.length === 0) {
        this.freeformPoints.push(point2D);
        this.drawFreeformLine();
      } else {
        // If the user clicked the first point again, close the polygon
        if (
          point2D.distanceTo(this.freeformPoints[0]) <
          this.gridSize / this.gridDivision / 2
        ) {
          this.extrudeFreeformShape();
          this.resetFreeform();
        } else {
          // Add the new point and update the line
          this.freeformPoints.push(point2D);
          this.drawFreeformLine();
        }
      }
    }
  }

  private onMouseMove(event: MouseEvent) {
    const brect = this.renderer.domElement.getBoundingClientRect();

    const mouse = new THREE.Vector2(
      ((event.clientX - brect.left) / this.rendererWidth) * 2 - 1,
      ((event.clientY - brect.top) / this.rendererHeight) * -2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObject(this.gridHelper);

    if (intersects.length == 0) {
      this.hoverPoint.visible = false;
      return;
    }

    const point = new THREE.Vector3().copy(intersects[0].point);
    point.y = 0; // Ensure point is on the X-Z plane

    const gridRatio = this.gridSize / this.gridDivision;
    point.x = Math.round(point.x / gridRatio) * gridRatio;
    point.z = Math.round(point.z / gridRatio) * gridRatio;

    // Update hover point position
    if (this.hoverPoint) {
      this.hoverPoint.position.set(point.x, point.y, point.z);
      this.hoverPoint.visible = true;
    }
  }

  private drawFreeformLine() {
    if (this.freeformLine) {
      this.scene.remove(this.freeformLine);
    }
    console.log(this.freeformPoints);
    const shape = new THREE.Shape(this.freeformPoints);
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    this.freeformLine = new THREE.Mesh(geometry, material);

    this.scene.add(this.freeformLine);
  }

  private extrudeFreeformShape() {
    const shape = new THREE.Shape(this.freeformPoints);
    const extrudeSettings = { depth: 10, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

    const extrudedShape = new THREE.Mesh(geometry, material);
    extrudedShape.castShadow = true;
    extrudedShape.receiveShadow = true;
    extrudedShape.userData['interactive'] = true;
    this.scene.add(extrudedShape);
  }

  public startFreeformCreation() {
    this.isCreateFreeForm = true;
    this.camera.position.set(0, 75, 0);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.gridHelper);
    this.orbitControls.enablePan = false;
    this.orbitControls.enableRotate = false;
  }

  private resetFreeform() {
    if (this.freeformLine) {
      this.scene.remove(this.freeformLine);
    }
    this.freeformPoints = [];
    this.hoverPoint.visible = false;
    this.freeformLine = null;
    this.orbitControls.enableRotate = true;
    this.orbitControls.enablePan = true;
    this.isCreateFreeForm = false;
    this.scene.remove(this.gridHelper);
  }

  ngAfterViewInit(): void {
    this.initThree();
    this.animate();
  }

  private initThree() {
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(
      75,
      this.rendererWidth / this.rendererHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 5);

    // Create a directional light with shadows
    const light = new THREE.DirectionalLight(0xffffff, 10);
    light.position.set(100, 100, 100);
    light.lookAt(0, 0, 0);
    light.castShadow = true; // Enable shadows for this light
    this.scene.add(light);

    // Add ambient light for softer lighting
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    this.scene.add(ambientLight);

    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // GridHelper for the X-Y plane
    this.gridHelper = new THREE.GridHelper(
      this.gridSize,
      this.gridDivision,
      0x000000,
      0x808080
    );
    this.gridHelper.position.y = 0.01; // Slightly above the ground to avoid z-fighting
    this.scene.add(this.gridHelper);
    this.scene.remove(this.gridHelper);

    // HOverpoint for hover on create
    const pointGeometry = new THREE.SphereGeometry(0.2);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.hoverPoint = new THREE.Mesh(pointGeometry, pointMaterial);
    this.hoverPoint.visible = false; // Initially hidden
    this.scene.add(this.hoverPoint);

    // Ground Plane (X-Y plane, Z = 0)
    const planeGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 }); // Forest Green
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2; // Rotate the plane to lie on the X-Y plane
    plane.position.y = 0; // Position it at Z = 0
    this.scene.add(plane);

    // Create the renderer and enable shadow maps
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.rendererWidth, this.rendererHeight);
    this.renderer.shadowMap.enabled = true; // Enable shadow maps
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    window.addEventListener('click', (event) => {
      if (this.isCreateFreeForm) {
        this.onFreeformClick(event);
      }
    });

    window.addEventListener('mousemove', (event) => {
      if (this.isCreateFreeForm) {
        this.onMouseMove(event);
      }
    });

    window.addEventListener('resize', () => this.onWindowResize());
    // OrbitControls
    this.orbitControls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.25;
    this.orbitControls.enableZoom = true;
    this.orbitControls.zoomSpeed = 1.2;
    this.orbitControls.enablePan = true;

    this.transformControls = new TransformControls(
      this.camera,
      this.renderer.domElement
    );
    this.transformControls.addEventListener('change', () =>
      this.renderer.render(this.scene, this.camera)
    );

    this.transformControls.addEventListener(
      'mouseDown',
      () => (this.orbitControls.enabled = false)
    );
    this.transformControls.addEventListener(
      'mouseUp',
      () => (this.orbitControls.enabled = true)
    );

    this.scene.add(this.transformControls);

    // Add event listener to control object positions
    this.transformControls.addEventListener('objectChange', () =>
      this.limitObjectToPlane()
    );
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Delete') {
        this.deleteSelectedObject();
      }
    });
    this.canvasContainer.nativeElement.addEventListener(
      'mousedown',
      (event: any) => this.onMouseDown(event)
    );
  }

  // Prevent objects from going below the X-Y plane
  private limitObjectToPlane() {
    if (this.selectedObject) {
      this.selectedObject.position.y = Math.max(
        this.selectedObject.position.y,
        0.1
      ); // Ensure the object stays above the plane
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  private setSelectedObject(object: THREE.Object3D) {
    this.selectedObject = object;

    if (object.userData['disableZ']) {
      this.transformControls.showY = false;
    } else {
      this.transformControls.showY = true;
    }

    // Update position and dimensions
    this.position = {
      x: object.position.x,
      y: object.position.y,
      z: object.position.z,
    };

    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry as THREE.BoxGeometry;
      if (geometry) {
        geometry.computeBoundingBox();
        this.dimensions = {
          width: geometry.boundingBox!.max.x - geometry.boundingBox!.min.x,
          height: geometry.boundingBox!.max.y - geometry.boundingBox!.min.y,
          depth: geometry.boundingBox!.max.z - geometry.boundingBox!.min.z,
        };
      }
    }

    this.transformControls.attach(object);
  }

  private onWindowResize() {
    this.camera.aspect = this.rendererWidth / this.rendererHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.rendererWidth, this.rendererHeight);
  }

  public addCube() {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new Mesh(geometry, material);
    cube.position.set(0, 0, 0); // Ensure the cube is at (0, 0, 0) with respect to the ground plane
    cube.userData['interactive'] = true; // Mark as interactive
    cube.userData['disableZ'] = false; // Mark as interactive
    cube.castShadow = true;
    cube.receiveShadow = true;

    this.scene.add(cube);
    this.setSelectedObject(cube);
  }

  public addGarden() {
    const geometry = new THREE.PlaneGeometry(20, 20); // Create a large flat plane for the garden
    const material = new THREE.MeshStandardMaterial({ color: 0x9acd32 }); // Green color for grass
    const garden = new THREE.Mesh(geometry, material);
    garden.receiveShadow = true;
    garden.rotation.x = -Math.PI / 2; // Rotate to lie on the X-Y plane
    garden.position.y = 1e-100; // Slightly above the ground to avoid z-fighting
    garden.userData['interactive'] = true; // Mark as non-interactive
    garden.userData['disableZ'] = true; // Mark as interactive

    this.scene.add(garden);
    this.setSelectedObject(garden); // Optionally, you can still attach transform controls to it
  }

  public addTree() {
    // Example tree: a simple green sphere with a brown cylinder trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // Brown color
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.position.set(0, 0, 0);

    const leavesGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 }); // Green color
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    leaves.position.set(0, 1, 0);
    trunk.userData['interactive'] = true;
    leaves.userData['interactive'] = true;

    const tree = new THREE.Group();
    tree.add(trunk);
    tree.add(leaves);
    tree.castShadow = true;
    tree.receiveShadow = true;
    tree.userData['disableZ'] = false; // Mark as interactive

    tree.position.set(0, 0, 0); // Position it at the origin
    this.scene.add(tree);
    this.setSelectedObject(tree);
  }

  public addRoof() {
    const geometry = new THREE.ConeGeometry(1.5, 1, 4); // A pyramid-like shape
    const material = new THREE.MeshStandardMaterial({ color: 0xa52a2a }); // Dark red color for roof
    const roof = new THREE.Mesh(geometry, material);
    roof.position.set(0, 3.5, 0); // Position it above the wall
    roof.rotation.y = Math.PI / 4; // Rotate to make it look like a roof
    roof.userData['interactive'] = true; // Mark as interactive
    roof.userData['disableZ'] = false; // Mark as interactive
    roof.castShadow = true;
    roof.receiveShadow = true;

    this.scene.add(roof);
    this.setSelectedObject(roof);
  }

  private onMouseDown(event: MouseEvent) {
    if (!this.orbitControls.enabled) {
      return;
    }
    const raycaster = new THREE.Raycaster();

    const brect = this.renderer.domElement.getBoundingClientRect();

    const mouse = new THREE.Vector2(
      ((event.clientX - brect.left) / this.rendererWidth) * 2 - 1,
      ((event.clientY - brect.top) / this.rendererHeight) * -2 + 1
    );

    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObjects(this.scene.children);

    // Loop through intersections to find the first interactive object
    for (let i = 0; i < intersects.length; i++) {
      const intersectedObject = intersects[i].object;
      if (
        intersectedObject.userData['interactive'] &&
        this.selectedObject?.id != intersectedObject.id
      ) {
        if (intersectedObject?.parent?.type === 'Group') {
          this.setSelectedObject(intersectedObject.parent);
          return;
        }
        this.setSelectedObject(intersectedObject);
        return; // Stop searching after finding the first interactive object
      }
    }

    // If no interactive object was found, detach transform controls
    this.transformControls.detach();
    this.selectedObject = null;
  }

  public updatePosition() {
    if (this.selectedObject) {
      this.selectedObject.position.set(
        this.position.x,
        this.position.y,
        this.position.z
      );
    }
  }

  public updateSize() {
    if (this.selectedObject && this.selectedObject instanceof THREE.Mesh) {
      const geometry = this.selectedObject.geometry as THREE.BoxGeometry;
      if (geometry) {
        geometry.computeBoundingBox();
        const oldDimensions = this.dimensions;
        const newDimensions = {
          width: geometry.boundingBox!.max.x - geometry.boundingBox!.min.x,
          height: geometry.boundingBox!.max.y - geometry.boundingBox!.min.y,
          depth: geometry.boundingBox!.max.z - geometry.boundingBox!.min.z,
        };
        this.selectedObject.scale.set(
          newDimensions.width / oldDimensions.width,
          newDimensions.height / oldDimensions.height,
          newDimensions.depth / oldDimensions.depth
        );

        geometry.dispose(); // Dispose of old geometry
        this.selectedObject.geometry = new THREE.BoxGeometry(
          this.dimensions.width,
          this.dimensions.height,
          this.dimensions.depth
        );
      }
    }
  }

  private deleteSelectedObject() {
    if (this.selectedObject) {
      this.scene.remove(this.selectedObject);
      this.selectedObject = null;
      this.transformControls.detach();
    }
  }
}
