def magic():
    n = int(input("Enter any number : "))
    x = n
    
    while n >= 10:
        s = 0
        while n > 0:
            s = s + (n % 10)
            n = n // 10
        n = s
        
        if n < 0:
            break
    if n == 1:
        print(f"{x} is a magic number")
    else :
        print(f"{x} is a not magic number")


magic()