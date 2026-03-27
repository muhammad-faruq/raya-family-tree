"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import "cropperjs/dist/cropper.css";
import "./chart-theme.css";
import OverviewTree from "./OverviewTree";

function formatBirthdayForDisplay(raw: unknown): string {
  if (!raw) return "";
  const value = String(raw).trim();
  if (!value) return "";

  // Try to parse as Date; works well for ISO (YYYY-MM-DD) and many other formats
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return value;

  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const DATA_URL = "/api/family";

/** Opens a modal to crop an image to a square; calls onDone with the cropped data URL or null if cancelled. */
function openCropModal(imageDataUrl: string, onDone: (croppedDataUrl: string | null) => void) {
  const overlay = document.createElement("div");
  overlay.className = "f3-crop-overlay";
  overlay.innerHTML = `
    <div class="f3-crop-modal">
      <div class="f3-crop-header">
        <span class="f3-crop-title">Crop to square</span>
        <div class="f3-crop-actions">
          <button type="button" class="f3-crop-cancel">Cancel</button>
          <button type="button" class="f3-crop-apply">Apply</button>
        </div>
      </div>
      <div class="f3-crop-body">
        <img src="" alt="Crop" class="f3-crop-image" />
      </div>
    </div>
  `;

  const img = overlay.querySelector(".f3-crop-image") as HTMLImageElement;
  const btnCancel = overlay.querySelector(".f3-crop-cancel") as HTMLButtonElement;
  const btnApply = overlay.querySelector(".f3-crop-apply") as HTMLButtonElement;

  if (!img || !btnCancel || !btnApply) return;

  img.src = imageDataUrl;
  document.body.appendChild(overlay);

  type CropperInstance = {
    destroy: () => void;
    getCroppedCanvas: (opts?: { width?: number; height?: number; imageSmoothingQuality?: string }) => HTMLCanvasElement;
  };
  let cropper: CropperInstance | null = null;

  function close(result: string | null) {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    overlay.remove();
    onDone(result);
  }

  btnCancel.addEventListener("click", () => close(null));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(null);
  });

  img.addEventListener("load", () => {
    import("cropperjs")
      .then((mod) => {
        cropper = new mod.default(img, {
          aspectRatio: 1,
          viewMode: 1,
          dragMode: "move",
          autoCropArea: 0.8,
        });
      })
      .catch((err) => {
        console.error("Failed to load cropper:", err);
        close(imageDataUrl);
      });
  });
  img.addEventListener("error", () => close(null));

  btnApply.addEventListener("click", () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({
      width: 256,
      height: 256,
      imageSmoothingQuality: "high",
    });
    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    close(croppedDataUrl);
  });
}

export default function FamilyTree() {
  const cont = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof f3.createChart> | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  // ── Toggle overview on Escape ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverviewOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Build the family-chart (runs once) ────────────────────────────────────
  useEffect(() => {
    if (!cont.current) return;
    fetch(DATA_URL)
      .then((res) => res.json())
      .then((data: f3.Data) => {
        // Add formatted birthday for display on cards
        if (Array.isArray(data)) {
          for (const item of data as any[]) {
            const d = item?.data ?? {};
            d.birthdayDisplay = formatBirthdayForDisplay(d.birthday);
            item.data = d;
          }
        }
        create(data);
      })
      .catch((err) => console.error(err));

    function create(data: f3.Data) {
      const f3Chart = f3
        .createChart("#FamilyChart", data)
        .setTransitionTime(500)
        .setCardXSpacing(250)
        .setCardYSpacing(150)
        .setShowSiblingsOfMain(true);

      chartRef.current = f3Chart;

      const f3Card = f3Chart
        .setCardHtml()
        .setCardDisplay([["first name"], ["birthdayDisplay"]])
        .setMiniTree(true)
        .setOnCardUpdate(function (this: HTMLElement, d: f3.TreeDatum) {
          if (d.data._new_rel_data) return;
          if (f3EditTree.isRemovingRelative()) return;

          d3.select(this).select(".card").style("cursor", "default");
          const card = this.querySelector(".card-inner");
          if (!card) return;
          d3.select(card as HTMLElement)
            .append("div")
            .attr("class", "f3-svg-circle-hover")
            .attr(
              "style",
              "cursor: pointer; width: 20px; height: 20px;position: absolute; top: 0; right: 0;"
            )
            .html(f3.icons.userEditSvgIcon())
            .select("svg")
            .style("padding", "0")
            .on("click", (e: MouseEvent) => {
              e.stopPropagation();
              f3EditTree.open(d.data);
              if (f3EditTree.isAddingRelative()) return;
              if (f3EditTree.isRemovingRelative()) return;
              f3Card.onCardClickDefault(e, d);
            });
          d3.select(card as HTMLElement)
            .append("div")
            .attr("class", "f3-svg-circle-hover")
            .attr(
              "style",
              "cursor: pointer; width: 20px; height: 20px;position: absolute; top: 0; right: 23px;"
            )
            .html(f3.icons.userPlusSvgIcon())
            .select("svg")
            .style("padding", "0")
            .on("click", (e: MouseEvent) => {
              e.stopPropagation();
              if (f3EditTree.isAddingRelative()) {
                if (f3Chart.store.getMainDatum().id === d.data.id) {
                  f3EditTree.addRelativeInstance?.onCancel?.();
                } else {
                  f3EditTree.addRelativeInstance?.onCancel?.();
                  f3EditTree.open(d.data);
                  f3Card.onCardClickDefault(e, d);
                  (document.querySelector(".f3-add-relative-btn") as HTMLElement | null)?.click();
                }
              } else {
                f3EditTree.open(d.data);
                f3Card.onCardClickDefault(e, d);
                (document.querySelector(".f3-add-relative-btn") as HTMLElement | null)?.click();
              }
            });
        });

      f3Card.setOnCardClick((e: MouseEvent, d: f3.TreeDatum) => {
        if (f3EditTree.isAddingRelative()) {
          if (d.data._new_rel_data) {
            f3EditTree.open(d.data);
          } else {
            f3EditTree.addRelativeInstance?.onCancel?.();
            f3EditTree.closeForm?.();
            f3Card.onCardClickDefault(e, d);
          }
        } else if (f3EditTree.isRemovingRelative()) {
          f3EditTree.open(d.data);
        } else {
          if (f3Chart.getMainDatum().id === d.data.id) {
            f3EditTree.open(d.data);
            f3Card.onCardClickDefault(e, d);
          } else {
            f3EditTree.closeForm();
            f3Card.onCardClickDefault(e, d);
          }
        }
      });

      const f3EditTree = f3Chart
        .editTree()
        .fixed()
        .setFields(["first name", "birthday", "avatar"])
        .setEditFirst(true);

      f3EditTree.setOnFormCreation(({ cont }) => {
        // Rename "first name" label to "Name"
        const firstNameInput = cont.querySelector<HTMLInputElement>('input[name="first name"]');
        if (firstNameInput) {
          const field = firstNameInput.closest(".f3-form-field");
          const label = field?.querySelector("label");
          if (label) label.textContent = "Name";
        }

        // Enhance birthday field with a native datepicker
        const birthdayInput = cont.querySelector<HTMLInputElement>('input[name="birthday"]');
        if (birthdayInput) {
          birthdayInput.type = "date";
          const field = birthdayInput.closest(".f3-form-field");
           const label = field?.querySelector("label");
           if (label) label.textContent = "Date of Birth";
        }

        // Close the form when the user submits successfully
        const submitBtn = cont.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submitBtn) {
          submitBtn.addEventListener("click", () => {
            // Defer to allow the library to process the submit first
            setTimeout(() => {
              f3EditTree.closeForm?.();
            }, 0);
          });
        }

        // Clarify what the cancel button does
        const buttons = Array.from(
          cont.querySelectorAll<HTMLButtonElement>("button")
        );
        const cancelBtn = buttons.find(
          (btn) => btn.textContent?.trim().toLowerCase() === "cancel"
        );
        if (cancelBtn) {
          cancelBtn.title = "Cancel closes this form and discards any unsaved changes.";

          const note = document.createElement("div");
          note.textContent = "Cancel will close this form and ignore any changes you made.";
          note.style.fontSize = "11px";
          note.style.opacity = "0.7";
          note.style.marginTop = "4px";

          const parent = cancelBtn.parentElement;
          if (parent) {
            parent.appendChild(note);
          }
        }

        const avatarInput = cont.querySelector<HTMLInputElement>('input[name="avatar"]');
        if (!avatarInput) return;
        const field = avatarInput.closest(".f3-form-field");
        if (!field) return;

        // Rename avatar label to "Image"
        const avatarLabel = field.querySelector("label");
        if (avatarLabel) {
          avatarLabel.textContent = "Image";
        }

        avatarInput.setAttribute("type", "hidden");
        avatarInput.classList.add("f3-avatar-value");

        const accept = "image/jpeg,image/png,image/gif,image/webp";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = accept;
        fileInput.className = "f3-avatar-file-input";
        fileInput.setAttribute("aria-label", "Upload avatar image");

        const fileLabel = document.createElement("span");
        fileLabel.className = "f3-avatar-file-label";
        fileLabel.textContent = "Choose File";

        const fileWrap = document.createElement("div");
        fileWrap.className = "f3-avatar-file-wrap";
        fileWrap.appendChild(fileInput);
        fileWrap.appendChild(fileLabel);

        const preview = document.createElement("img");
        preview.className = "f3-avatar-preview";
        preview.alt = "Avatar preview";
        preview.style.display = "none";
        if (avatarInput.value && avatarInput.value.startsWith("data:image")) {
          preview.src = avatarInput.value;
          preview.style.display = "block";
        }

        const wrap = document.createElement("div");
        wrap.className = "f3-avatar-upload";
        wrap.appendChild(fileWrap);
        wrap.appendChild(preview);
        field.appendChild(wrap);

        fileInput.addEventListener("change", () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (!dataUrl) return;
            openCropModal(dataUrl, (croppedDataUrl) => {
              if (croppedDataUrl) {
                avatarInput.value = croppedDataUrl;
                preview.src = croppedDataUrl;
                preview.style.display = "block";
              }
              fileInput.value = "";
            });
          };
          reader.readAsDataURL(file);
        });
      });

      f3EditTree.setEdit();

      f3EditTree.setOnChange(() => {
        const data = f3EditTree.exportData();
        const payload = Array.isArray(data) ? data : [];

        // Keep display field in sync with stored birthday value
        for (const item of payload as any[]) {
          const d = item?.data ?? {};
          d.birthdayDisplay = formatBirthdayForDisplay(d.birthday);
          item.data = d;
        }

        fetch(DATA_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch((err) => console.error("Failed to persist family data:", err));
      });

      f3Chart.updateTree({ initial: true });
    }
  }, []);

  // ── When user clicks a person in overview, focus them in the normal chart ──
  const handleSelectPerson = useCallback((id: string) => {
    if (!chartRef.current) return;
    try {
      chartRef.current.updateMainId(id);
      chartRef.current.updateTree({ initial: false });
    } catch {
      // graceful — some versions of family-chart may use a different API
    }
  }, []);

  return (
    <>
      {/* Escape hint shown in the normal view */}
      {!overviewOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            color: "rgba(255,255,255,0.55)",
            fontSize: 12,
            padding: "6px 16px",
            borderRadius: 20,
            pointerEvents: "none",
            letterSpacing: "0.04em",
            zIndex: 40,
          }}
        >
          Press <kbd style={{ fontFamily: "monospace", opacity: 0.8 }}>Esc</kbd> for full family overview
        </div>
      )}

      {/* Normal interactive chart — always mounted so state is preserved */}
      <div
        className="f3"
        id="FamilyChart"
        ref={cont}
        style={{
          width: "100%",
          height: "900px",
          margin: "auto",
          visibility: overviewOpen ? "hidden" : "visible",
        }}
      />

      {/* Overview mode */}
      {overviewOpen && (
        <OverviewTree
          onSelectPerson={handleSelectPerson}
          onClose={() => setOverviewOpen(false)}
        />
      )}
    </>
  );
}
