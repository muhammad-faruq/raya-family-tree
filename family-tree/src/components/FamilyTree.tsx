"use client";

import { useRef, useEffect } from "react";
import * as d3 from "d3";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import "./chart-theme.css";

const DATA_URL = "/api/family";

export default function FamilyTree() {
  const cont = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cont.current) return;
    fetch(DATA_URL)
      .then((res) => res.json())
      .then((data: f3.Data) => create(data))
      .catch((err) => console.error(err));

    function create(data: f3.Data) {
      const f3Chart = f3
        .createChart("#FamilyChart", data)
        .setTransitionTime(500)
        .setCardXSpacing(250)
        .setCardYSpacing(150)
        .setShowSiblingsOfMain(true);

      const f3Card = f3Chart
        .setCardHtml()
        .setCardDisplay([["first name", "last name"], ["birthday"]])
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
        .setFields(["first name", "last name", "birthday", "avatar"])
        .setEditFirst(true);

      f3EditTree.setEdit();

      f3EditTree.setOnChange(() => {
        const data = f3EditTree.exportData();
        const payload = Array.isArray(data) ? data : [];
        fetch(DATA_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch((err) => console.error("Failed to persist family data:", err));
      });

      f3Chart.updateTree({ initial: true });
    }
  }, []);

  return (
    <div
      className="f3"
      id="FamilyChart"
      ref={cont}
      style={{
        width: "100%",
        height: "900px",
        margin: "auto",
      }}
    />
  );
}
