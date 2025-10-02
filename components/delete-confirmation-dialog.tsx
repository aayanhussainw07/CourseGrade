"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  itemType: "course" | "semester"
  onConfirm: () => void
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  itemName,
  itemType,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const [confirmText, setConfirmText] = useState("")

  const handleConfirm = () => {
    if (confirmText === itemName) {
      onConfirm()
      setConfirmText("")
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    setConfirmText("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {itemType === "course" ? "Course" : "Semester"}</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the {itemType}{" "}
            <span className="font-semibold text-foreground">{itemName}</span>
            {itemType === "semester" && " and all its courses"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <span className="font-semibold text-foreground">{itemName}</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmText === itemName) {
                  handleConfirm()
                }
              }}
              placeholder={itemName}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={confirmText !== itemName}>
            Delete {itemType === "course" ? "Course" : "Semester"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
